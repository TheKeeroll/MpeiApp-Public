import type {ScheduleRequestType, ScheduleTarget} from '../DataTypes';

export type ScheduleCandidate = ScheduleTarget & {label: string};
export const SCHEDULE_REQUEST_TYPES: readonly ScheduleRequestType[] = ['group', 'auditorium', 'person'];
export const isScheduleRequestType = (value: unknown): value is ScheduleRequestType => (
  SCHEDULE_REQUEST_TYPES.includes(value as ScheduleRequestType)
);
export const normalizeScheduleQuery = (value: string): string => value.trim();
export const isValidScheduleQuery = (value: string): boolean => normalizeScheduleQuery(value).length >= 3;
const comparable = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('ru');

export const classifyScheduleQuery = (value: string): ScheduleRequestType => (
  !/\d/.test(value) ? 'person' : /\d{3}/.test(value) ? 'auditorium' : 'group'
);

/** A malformed/SSO response is different from a valid empty directory. */
export const parseScheduleDiscovery = (value: unknown, type: ScheduleRequestType): ScheduleCandidate[] => {
  if (!Array.isArray(value)) throw new Error('Invalid schedule directory');
  const result: ScheduleCandidate[] = [];
  const seen = new Set<string>();
  for (const row of value) {
    if (!row || row.type !== type || typeof row.label !== 'string' || !row.label.trim()
      || !['number', 'string'].includes(typeof row.id) || !/^[1-9]\d*$/.test(String(row.id))) continue;
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({id, type, label: row.label.trim()});
  }
  if (value.length && !result.length) throw new Error('Invalid schedule directory entries');
  return result;
};

export const rankScheduleCandidates = (
  candidates: ScheduleCandidate[], query: string, currentYear: number, exactGroup = false,
): ScheduleCandidate[] => {
  const normalized = comparable(query);
  const year = (label: string): number | undefined => {
    const suffix = label.match(/-(\d{2})$/)?.[1];
    // Group admission years are modern two-digit years, not lecturer/room IDs.
    return suffix === undefined ? undefined : 2000 + Number(suffix);
  };
  return candidates.filter(candidate => {
    if (candidate.type !== 'group') return true;
    if (exactGroup) return comparable(candidate.label) === normalized;
    const admission = year(candidate.label);
    return query.trim().length >= 7 || admission === undefined || currentYear - admission <= 5;
  }).sort((a, b) => {
    if (a.type !== 'group' || b.type !== 'group') return 0;
    const exact = Number(comparable(b.label) === normalized) - Number(comparable(a.label) === normalized);
    if (exact) return exact;
    return (year(b.label) ?? -1) - (year(a.label) ?? -1);
  });
};
