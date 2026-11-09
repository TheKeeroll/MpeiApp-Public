import fs from 'fs';
import path from 'path';
import {parseAppStorePage, currentReleaseNotes} from '../src/API/Parsers/AppStoreParser';
import {compareAppVersions, normalizeAppVersion} from '../src/Updates/AppVersion';

const fixture = (name: string) => fs.readFileSync(path.join(__dirname, 'fixtures/store-pages', name), 'utf8');

describe('store release parser', () => {
  it('extracts the real Google Play release, cutting the previous version from its notes', () => {
    const result = parseAppStorePage(fixture('google-play-current.html'), 'android');
    expect(result?.version).toBe('2.5.0');
    expect(result?.releaseNotes).toContain('Интегрирован DragoNet');
    expect(result?.releaseNotes).toContain('Исправлен ряд ошибок');
    expect(result?.releaseNotes).not.toContain('2.4.0');
    expect(result?.releaseNotes).not.toContain('Поддержка продолжается');
  });

  it('extracts the full latest App Store entry, ignoring review/version-history text', () => {
    const html = fixture('app-store-current.html') + '<p>Версия 99.0.0 — отзыв пользователя</p>';
    const result = parseAppStorePage(html, 'ios');
    expect(result?.version).toBe('2.5.0');
    expect(result?.releaseNotes).toContain('Сентябрь горит');
    expect(result?.releaseNotes).toContain('Исправлен ряд ошибок');
    expect(result?.releaseNotes).not.toContain('отзыв пользователя');
    expect(result?.releaseNotes).not.toContain('Версия 2.5.0');
  });

  it('supports the previous Play array layout without evaluating the callback', () => {
    const details: unknown[] = [['MpeiApp']];
    details[140] = [[['v2.6.1-preview']]];
    details[144] = [null, [null, '2.6.1:<br>Исправлено: &quot;БАРС&quot; [тест]<br>2.5.0:<br>История']];
    const html = `<script>AF_initDataCallback({key: 'ds:42', data:${JSON.stringify([null, [null, null, details]])}, sideChannel: {}});throw new Error('never execute');</script>`;
    expect(parseAppStorePage(html, 'android')).toEqual({version: '2.6.1', releaseNotes: 'Исправлено: "БАРС" [тест]'});
  });

  it('can use scoped visible markup when structured App Store data is unavailable', () => {
    const html = '<script id="serialized-server-data">{bad}</script><p>Version 9.0.0 review</p>'
      + '<section class="whats-new"><p class="whats-new__latest__version">Версия v2.6.1-preview</p>'
      + '<div class="whats-new__content"><div class="we-truncate__content"><p>Название</p><ul><li>Первое</li><li>Второе &amp; третье</li></ul></div></div></section>';
    expect(parseAppStorePage(html, 'ios')).toEqual({version: '2.6.1', releaseNotes: 'Название\n\n• Первое\n• Второе & третье'});
  });

  it('preserves long release notes without a character/line truncation', () => {
    const notes = Array.from({length: 100}, (_, i) => `- Изменение ${i}: подробное описание без обрезки.`).join('\n');
    expect(currentReleaseNotes(`2.6.1:\n${notes}\n2.6.0:\nСтарое`, '2.6.1')).toBe(notes);
  });

  it('keeps an inline current title, ignores old preambles, and does not split mentions inside bullets', () => {
    const notes = 'История версий\n2.6.1 — Название релиза\n- В отличие от 2.5.0 работает вход\n- Обновлена библиотека 2.4.0\nВерсия 2.6.0:\nСтарое';
    expect(currentReleaseNotes(notes, '2.6.1')).toBe('Название релиза\n- В отличие от 2.5.0 работает вход\n- Обновлена библиотека 2.4.0');
    expect(currentReleaseNotes('Новое исправление\n2.5.0:\nИстория', '2.6.1')).toBe('Новое исправление');
  });

  it.each(['<html>CAPTCHA</html>', '<script>AF_initDataCallback({data: [broken});</script>', '',
    '<span itemprop="softwareVersion">Varies with device</span><div itemprop="releaseNotes">2.7.0: text</div>'])('fails closed on unusable data: %s', html => {
    expect(parseAppStorePage(html, 'android')).toBeUndefined();
    expect(parseAppStorePage(html, 'ios')).toBeUndefined();
  });
});

describe('numeric application versions', () => {
  it.each([
    ['v2.6.1-preview', '2.6.1'], ['Версия 2.6.1', '2.6.1'], ['Version: v2.6.1-beta+15', '2.6.1'],
    [' 02.006.001 ', '2.6.1'], ['2.6', '2.6'], ['2.6.1.4', '2.6.1.4'],
    ['2.6.1.4.5', undefined], ['unknown', undefined], ['', undefined],
  ])('normalizes %s to %s', (value, expected) => expect(normalizeAppVersion(value)).toBe(expected));

  it.each([
    ['2.10.0', '2.9.9', 1], ['2.6.1', 'v2.6.0-preview', 1], ['2.6.0', 'v2.6.0-preview', 0],
    ['2.6', '2.6.0', 0], ['2.6.0.1', '2.6', 1], ['2.5.9', '2.6.0', -1], ['broken', '2.6.0', undefined],
  ])('compares %s against %s', (left, right, expected) => expect(compareAppVersions(left, right)).toBe(expected));
});
