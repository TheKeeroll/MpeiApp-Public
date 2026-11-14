import type {ScheduleRequestType, ScheduleTarget} from '../API/DataTypes';
import {isScheduleRequestType, isValidScheduleQuery} from '../API/Parsers/ScheduleDiscoveryParser';

export const SCHEDULE_LIST_LIMIT = 5;
const STORAGE_KEY = 'scheduleSearchLibrary';
export type SavedSchedule = Readonly<ScheduleTarget & {name: string}>;
export type ScheduleLibrarySnapshot = Readonly<{recent: readonly SavedSchedule[]; favorites: readonly SavedSchedule[]}>;
type Storage = {getString(key: string): string | undefined; set(key: string, value: string): void};
const key = (entry: SavedSchedule) => `${entry.type}:${entry.id}`;
const same = (a: SavedSchedule, b: SavedSchedule) => key(a) === key(b)
  || (a.type === b.type && a.name.toLocaleLowerCase('ru') === b.name.toLocaleLowerCase('ru'));

export const compactScheduleName = ({name, type}: {name: string; type: ScheduleRequestType}): string => {
  if (type !== 'person') return name;
  const [surname, firstName] = name.trim().split(/\s+/);
  return firstName ? `${surname} ${Array.from(firstName)[0]}.` : name;
};

const readEntries = (value: unknown): SavedSchedule[] => {
  if (!Array.isArray(value)) return [];
  const result: SavedSchedule[] = [];
  for (const entry of value) {
    if (!entry || !isScheduleRequestType(entry.type) || typeof entry.id !== 'string' || !/^[1-9]\d*$/.test(entry.id)
      || typeof entry.name !== 'string' || !isValidScheduleQuery(entry.name)) continue;
    const normalized: SavedSchedule = {id: entry.id, name: entry.name.trim(), type: entry.type};
    if (!result.some(previous => same(previous, normalized))) result.push(normalized);
    if (result.length === SCHEDULE_LIST_LIMIT) break;
  }
  return result;
};

/** Device-local public timetable shortcuts, shared by guest and signed-in screens. */
export class ScheduleSearchLibrary {
  private snapshot: ScheduleLibrarySnapshot;
  private listeners = new Set<() => void>();
  constructor(private readonly storage: Storage) {
    let saved: any;
    try { saved = JSON.parse(storage.getString(STORAGE_KEY) ?? 'null'); } catch { /* Ignore corrupt shortcuts, not account data. */ }
    this.snapshot = {recent: readEntries(saved?.version === 1 ? saved.recent : []), favorites: readEntries(saved?.version === 1 ? saved.favorites : [])};
  }
  getSnapshot = (): ScheduleLibrarySnapshot => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private save(snapshot: ScheduleLibrarySnapshot) {
    try { this.storage.set(STORAGE_KEY, JSON.stringify({version: 1, ...snapshot})); }
    catch { console.warn('Schedule shortcuts could not be persisted.'); }
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener();
  }
  remember(entry: SavedSchedule) {
    const [normalized] = readEntries([entry]);
    if (!normalized) return;
    this.save({...this.snapshot, recent: [normalized, ...this.snapshot.recent.filter(previous => !same(previous, normalized))].slice(0, SCHEDULE_LIST_LIMIT)});
  }
  addFavorite(entry: SavedSchedule) {
    const [normalized] = readEntries([entry]);
    if (!normalized || this.snapshot.favorites.length >= SCHEDULE_LIST_LIMIT || this.isFavorite(normalized)) return;
    this.save({...this.snapshot, favorites: [...this.snapshot.favorites, normalized]});
  }
  isFavorite(entry: SavedSchedule): boolean { return this.snapshot.favorites.some(previous => same(previous, entry)); }
  removeRecent(entry: SavedSchedule) { this.save({...this.snapshot, recent: this.snapshot.recent.filter(previous => !same(previous, entry))}); }
  removeFavorite(entry: SavedSchedule) { this.save({...this.snapshot, favorites: this.snapshot.favorites.filter(previous => !same(previous, entry))}); }
}
