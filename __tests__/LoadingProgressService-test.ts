import {LoadingProgressService} from '../src/Loading/LoadingProgressService';
import {getLoadingProgressLabel} from '../src/Loading/LoadingProgressLabel';

describe('LoadingProgressService', () => {
  it('reports successful and failed stage transitions', () => {
    const progress = new LoadingProgressService();
    const session = progress.start('login', 'Вход');

    expect(progress.advance(session, 'Загрузка профиля')).toBe(true);
    expect(progress.getSnapshot('login')).toEqual({
      current: {label: 'Загрузка профиля'},
      previous: {label: 'Вход', status: 'success'},
    });

    expect(progress.fail(session)).toBe(true);
    expect(progress.getSnapshot('login')).toEqual({
      previous: {label: 'Загрузка профиля', status: 'failed'},
    });
  });

  it('rejects stale sessions after a quick retry with the same key', () => {
    const progress = new LoadingProgressService();
    const stale = progress.start('schedule', 'Первый запрос');
    const current = progress.start('schedule', 'Повторный запрос');

    expect(progress.advance(stale, 'Поздний результат')).toBe(false);
    expect(progress.getSnapshot('schedule')).toEqual({current: {label: 'Повторный запрос'}});
    expect(progress.complete(current)).toBe(true);
  });

  it('keeps concurrent sessions isolated', () => {
    const progress = new LoadingProgressService();
    const login = progress.start('login', 'Вход');
    progress.start('map', 'Карта');

    progress.complete(login);
    expect(progress.getSnapshot('login')).toEqual({
      previous: {label: 'Вход', status: 'success'},
    });
    expect(progress.getSnapshot('map')).toEqual({current: {label: 'Карта'}});
  });

  it('stops invoking a listener after cleanup', () => {
    const progress = new LoadingProgressService();
    const listener = jest.fn();
    const unsubscribe = progress.subscribe('map', listener);
    const session = progress.start('map', 'Загрузка карты');
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    progress.complete(session);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('uses the supplied fallback label until a stage starts', () => {
    expect(getLoadingProgressLabel({}, 'Подготовка приложения...')).toBe('Подготовка приложения...');
    expect(getLoadingProgressLabel({current: {label: 'Загрузка карты'}}, 'Подготовка приложения...')).toBe('Загрузка карты');
  });
});
