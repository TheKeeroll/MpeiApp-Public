import {compactScheduleName, ScheduleSearchLibrary, type SavedSchedule} from '../src/Schedule/ScheduleSearchLibrary';

const entry = (id: number, type: SavedSchedule['type'] = 'group', name = `ГП-04-${id}`): SavedSchedule => ({id: String(id), type, name});
const setup = (raw?: string) => {
  let value = raw;
  const storage = {getString: () => value, set: (_: string, next: string) => { value = next; }};
  return {storage, store: new ScheduleSearchLibrary(storage)};
};
test('recent schedules are distinct, newest first, capped at five and restored after restart', () => {
  const {storage, store} = setup();
  for (let i = 1; i <= 7; i++) store.remember(entry(i));
  expect(store.getSnapshot().recent.map(row => row.id)).toEqual(['7', '6', '5', '4', '3']);
  store.remember(entry(5));
  expect(store.getSnapshot().recent.map(row => row.id)).toEqual(['5', '7', '6', '4', '3']);
  expect(new ScheduleSearchLibrary(storage).getSnapshot()).toEqual(store.getSnapshot());
});
test('favorites cap at five, ignore duplicates and remain independent of recent deletion', () => {
  const {store, storage} = setup();
  for (let i = 1; i <= 6; i++) { store.remember(entry(i)); store.addFavorite(entry(i)); }
  store.addFavorite(entry(1));
  expect(store.getSnapshot().favorites).toHaveLength(5);
  store.removeRecent(entry(3));
  expect(store.getSnapshot().favorites.map(row => row.id)).toContain('3');
  store.removeFavorite(entry(1));
  store.addFavorite(entry(6));
  expect(store.getSnapshot().favorites.map(row => row.id)).toEqual(['2', '3', '4', '5', '6']);
  expect(new ScheduleSearchLibrary(storage).getSnapshot()).toEqual(store.getSnapshot());
});
test('full canonical teacher query survives compact display, duplicate aliases and persistence', () => {
  const {store, storage} = setup();
  const teacher = entry(3999, 'person', 'Подкопаева Виктория Александровна');
  store.remember(teacher); store.addFavorite(teacher);
  store.remember({...teacher, id: '4000'});
  expect(store.getSnapshot().recent).toHaveLength(1);
  expect(compactScheduleName(teacher)).toBe('Подкопаева В.');
  expect(new ScheduleSearchLibrary(storage).getSnapshot().favorites[0]?.name).toBe(teacher.name);
  expect(compactScheduleName(entry(1, 'auditorium', 'НТБ-300'))).toBe('НТБ-300');
  expect(compactScheduleName(entry(1, 'group', 'ИЭоз-31м-25'))).toBe('ИЭоз-31м-25');
});
test.each(['{bad', JSON.stringify({version: 2, recent: [entry(1)]}), JSON.stringify({version: 1, recent: [null, {}, entry(2), entry(2)]})])('invalid shortcuts do not affect BARS data or exceed bounds: %#', raw => {
  const {store} = setup(raw);
  expect(store.getSnapshot().recent.length).toBeLessThanOrEqual(1);
  expect(store.getSnapshot().favorites).toEqual([]);
});
test('mutations notify all mounted panels and unsubscribe cleanly', () => {
  const {store} = setup(); const listener = jest.fn(); const stop = store.subscribe(listener);
  const initial = store.getSnapshot();
  expect(store.getSnapshot()).toBe(initial);
  store.remember(entry(1));
  expect(listener).toHaveBeenCalledTimes(1);
  expect(initial.recent).toEqual([]);
  stop(); store.addFavorite(entry(1));
  expect(listener).toHaveBeenCalledTimes(1);
});
test('a persistence failure does not turn a successful timetable request into a failure', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    const store = new ScheduleSearchLibrary({getString: () => undefined, set: () => { throw new Error('full disk'); }});
    expect(() => store.remember(entry(1))).not.toThrow();
    expect(store.getSnapshot().recent).toHaveLength(1);
  } finally { warn.mockRestore(); }
});
