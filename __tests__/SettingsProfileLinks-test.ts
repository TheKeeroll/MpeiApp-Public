import {avatarTitle, profileLinks, resolveProfileLink} from '../src/Screens/Settings/ProfileLinks';

test.each([
  ['https://vk.ru/person', 'vk'],
  ['https://m.vk.ru/person', 'vk'],
  ['https://t.me/person', 'telegram'],
  ['https://telegram.me/person', 'telegram'],
  ['https://web.telegram.org/', 'telegram'],
  ['https://WWW.Instagram.com/person', 'instagram'],
  ['https://m.youtube.com/@person', 'youtube'],
  ['https://youtu.be/example', 'youtube'],
  ['https://www.tiktok.com/@person', 'tiktok'],
  ['https://vm.tiktok.com/example', 'tiktok'],
  ['https://github.com/person', 'link'],
  ['https://vk.ru.example.org/person', 'link'],
  ['https://youtube.com@unknown.example/person', 'link'],
  ['https://unknown.example/?url=https://t.me/person', 'link'],
  ['mailto:person@example.org', 'link'],
  ['not a URL', 'link'],
])('recognizes only the actual hostname of %s', (url, platform) => {
  expect(resolveProfileLink(url).platform).toBe(platform);
});

test('normalizes bare addresses, protocol-relative URLs and a legacy VK input before opening', () => {
  expect(resolveProfileLink(' t.me/person ').url).toBe('https://t.me/person');
  expect(resolveProfileLink('//youtube.com/@person').platform).toBe('youtube');
  // This is compatibility input, not an outgoing address stored in the app.
  expect(resolveProfileLink('https://vk.com/person?from=app#info').url).toBe('https://vk.ru/person?from=app#info');
});

test('takes at most four distinct, nonempty links and keeps single-link compatibility', () => {
  expect(profileLinks(undefined)).toEqual([]);
  expect(profileLinks('https://vk.ru/person')).toHaveLength(1);
  const links = profileLinks(['', 'https://vk.ru/person', ' https://vk.ru/person ', 'https://t.me/person',
    'https://instagram.com/person', 'https://youtube.com/@person', 'https://tiktok.com/@person']);
  expect(links.map(link => link.platform)).toEqual(['vk', 'telegram', 'instagram', 'youtube']);
});

test('selected logos and the neutral link exist in the installed icon fonts', () => {
  const glyphs = require('react-native-vector-icons/glyphmaps/FontAwesome5Free.json');
  const families = require('react-native-vector-icons/glyphmaps/FontAwesome5Free_meta.json');
  for (const url of ['https://vk.ru/p', 'https://t.me/p', 'https://instagram.com/p', 'https://youtube.com/@p', 'https://tiktok.com/@p', 'https://example.org/p']) {
    const link = resolveProfileLink(url);
    expect(glyphs[link.icon]).toEqual(expect.any(Number));
    expect(families[link.platform === 'link' ? 'solid' : 'brands']).toContain(link.icon);
  }
});

test('names use two logical lines, preserve explicit line breaks and keep mononyms intact', () => {
  expect(avatarTitle('Гэсэр Петрунин')).toBe('Гэсэр\nПетрунин');
  expect(avatarTitle("Антон 'DragonSavA' Савенков")).toBe("Антон 'DragonSavA'\nСавенков");
  expect(avatarTitle('Николай')).toBe('Николай');
  expect(avatarTitle('Имя\nФамилия')).toBe('Имя\nФамилия');
});
