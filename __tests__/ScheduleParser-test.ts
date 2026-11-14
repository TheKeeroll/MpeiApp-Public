import moment from 'moment';
import {ParseTsMPEISchedule, DealWithMeal, CalculateRange, normalizeSavedSchedule} from '../src/API/Parsers/ScheduleParser';
import {classifyScheduleQuery, isValidScheduleQuery, parseScheduleDiscovery, rankScheduleCandidates} from '../src/API/Parsers/ScheduleDiscoveryParser';
import {serializeScheduleWidget} from '../src/Widgets/ScheduleWidgetData';
import lessons from './fixtures/schedules/lessons.json';

const candidates = (names: string[]) => names.map((label, i) => ({id: String(i + 1), type: 'group' as const, label}));

test.each([['ab', false], [' a ', false], [' ГП- ', true], ['К-2', true]])('minimum search length after trimming: %s', (query, valid) => {
  expect(isValidScheduleQuery(query)).toBe(valid);
});
test.each([['ГП-', 'person'], ['К-2', 'group'], ['НТБ-300', 'auditorium'], ['ИЭоз-31м-25', 'group']])('initial type: %s', (query, type) => {
  expect(classifyScheduleQuery(query)).toBe(type);
});
test('the whole directory is validated and deduplicated, without swallowing an invalid/SSO schema', () => {
  expect(parseScheduleDiscovery([{id: 1, type: 'group', label: 'ГП-04-24'}, {id: 1, type: 'group', label: 'duplicate'},
    {id: 2, type: 'group', label: 'ГП-04-26'}, {id: null, type: 'group', label: 'invalid'}], 'group')).toHaveLength(2);
  expect(parseScheduleDiscovery([], 'group')).toEqual([]);
  expect(() => parseScheduleDiscovery({login: 'required'}, 'person')).toThrow();
  expect(() => parseScheduleDiscovery([{id: '../../login', type: 'group', label: 'invalid'}], 'group')).toThrow();
});
test('youngest group wins even when fifth; exact full name wins over a younger prefix match', () => {
  const rows = candidates(['ГП-04-22', 'ГП-04-23', 'ГП-04-24', 'ГП-04-25', 'ГП-04-26']);
  expect(rankScheduleCandidates(rows, 'ГП-04-', 2026)[0]?.label).toBe('ГП-04-26');
  expect(rankScheduleCandidates(rows, 'ГП-04-24', 2026)[0]?.label).toBe('ГП-04-24');
  expect(rows[0]?.label).toBe('ГП-04-22'); // never reorder the caller's directory
});
test('age boundary is five years, depends on the year, and is bypassed only by explicit long queries', () => {
  const rows = candidates(['ЭР-11-19', 'ЭР-11-20', 'ЭР-11-21', 'ИЭоз-31м-25', 'Неизвестно']);
  expect(rankScheduleCandidates(rows, ' ЭР- ', 2026).map(row => row.label)).toEqual(['ИЭоз-31м-25', 'ЭР-11-21', 'Неизвестно']);
  expect(rankScheduleCandidates(rows, 'ЭР-', 2027).map(row => row.label)).not.toContain('ЭР-11-21');
  expect(rankScheduleCandidates(rows, 'ЭР-11-', 2026).map(row => row.label)).not.toContain('ЭР-11-19');
  expect(rankScheduleCandidates(rows, 'ЭР-11-1', 2026).map(row => row.label)).toContain('ЭР-11-19');
  expect(rankScheduleCandidates(rows, 'ЭР-11-19', 2026, true).map(row => row.label)).toEqual(['ЭР-11-19']);
});
test('nullable group/teachers do not remove valid lessons; missing dates are inserted and todayIndex is correct', () => {
  const result = ParseTsMPEISchedule([...lessons].reverse(), '18.11.2026');
  expect(result.days.map(day => day.date)).toEqual(['16.11.2026', '17.11.2026', '18.11.2026']);
  expect(result.todayIndex).toBe(2);
  expect(result.days[1]?.isEmpty).toBe(true);
  expect(result.days[0]?.lessons[0]?.group).toBe('ГП-04-26; ГПэ-04-26');
  expect(result.days[2]?.lessons[0]?.group).toBe('ГП-04-26; ГПэ-04-26');
  expect(result.days[2]?.lessons[0]?.teacher.name).toBe('-');
  expect(result.days[0]?.lessons[0]?.teacher).toMatchObject({fullName: 'Иванова Анна Борисовна', lec_oid: ''});
});
test('empty lecturer lists fall back to top-level full name; lecturerOid is never used as a discovery ID', () => {
  const result = ParseTsMPEISchedule([{...lessons[0], listOfLecturers: [], lecturer: 'Иванова А.Б.', lecturer_title: 'Иванова Анна Борисовна', lecturerOid: 15421}]);
  expect(result.days[0]?.lessons[0]?.teacher).toEqual({name: 'Иванова А.Б.', fullName: 'Иванова Анна Борисовна', lec_oid: ''});
});
test('sorts times, combines parallel classes, removes exact duplicates and inserts one lunch only between classes', () => {
  const a = {...lessons[0], beginLesson: '11:10', endLesson: '12:45'};
  const b = {...a, auditorium: 'Д-407'};
  const c = {...a, discipline: 'После обеда', beginLesson: '13:45', endLesson: '15:20'};
  const result = DealWithMeal(ParseTsMPEISchedule([c, a, a, b]));
  expect(result.days[0]?.lessons.map(row => row.type)).toEqual(['COMBINED', 'DINNER', 'COMMON']);
  expect(result.days[0]?.lessons[0]?.cabinet).toBe('М-802|Д-407');
  expect(DealWithMeal(result).days[0]?.lessons).toHaveLength(3);
  expect(DealWithMeal(ParseTsMPEISchedule([a])).days[0]?.lessons).toHaveLength(1);
  expect(DealWithMeal({todayIndex: -1, days: [{date: '17.11.2026', lessons: [], isEmpty: true, isToday: false}]}).days[0]?.lessons).toEqual([]);
});
test('accepts valid leap/cross-year dates instead of repairing real dates to the current year', () => {
  expect(ParseTsMPEISchedule([{...lessons[0], date: '2028.02.29'}]).days[0]?.date).toBe('29.02.2028');
  expect(ParseTsMPEISchedule([{...lessons[0], date: '2026.12.31'}, {...lessons[0], date: '2027.01.01'}]).days).toHaveLength(2);
  expect(() => ParseTsMPEISchedule([{...lessons[0], date: '2027.02.29'}])).toThrow();
});
test.each([{}, null, '<html>SSO</html>', [{date: 'bad'}]])('malformed timetable is not an empty success: %#', input => {
  expect(() => ParseTsMPEISchedule(input)).toThrow();
});
test('empty timetable is valid; legacy cache name is migrated without changing the widget contract', () => {
  expect(ParseTsMPEISchedule([])).toEqual({days: [], todayIndex: -1});
  const legacy = {...ParseTsMPEISchedule(lessons), fullTeacherName: 'Старое название'};
  const normalized = normalizeSavedSchedule(legacy);
  expect(normalized.scheduleName).toBe('Старое название');
  expect(normalized).not.toHaveProperty('fullTeacherName');
  const now = new Date('2026-11-16T12:00:00Z');
  expect(serializeScheduleWidget(normalized, now)).toBe(serializeScheduleWidget(legacy, now));
  expect(normalizeSavedSchedule({...legacy, scheduleName: 'Новое'}).scheduleName).toBe('Новое');
});
test.each(['2026-01-15', '2026-02-15', '2026-03-15', '2026-07-15', '2026-11-15'])('range is stable without Date prototype extensions: %s', date => {
  const [start, end] = CalculateRange(new Date(`${date}T12:00:00Z`));
  expect(moment(start).isBefore(end)).toBe(true);
});
