import type {ScheduleRequestType} from '../../API/DataTypes';
import {isScheduleRequestType} from '../../API/Parsers/ScheduleDiscoveryParser';

export type ScheduleSearchParams = Readonly<{
  searchQuery: string;
  searchType?: ScheduleRequestType;
}>;

export type ScheduleStackParamList = {
  guestScheduleMain: undefined;
  scheduleMain: ScheduleSearchParams | undefined;
};

export const createScheduleSearchParams = (searchQuery: string, searchType?: ScheduleRequestType): ScheduleSearchParams => ({
  searchQuery,
  ...(searchType ? {searchType} : {}),
});

export const getScheduleSearchType = (params: unknown): ScheduleRequestType | undefined => {
  const value = typeof params === 'object' && params !== null ? (params as ScheduleSearchParams).searchType : undefined;
  return isScheduleRequestType(value) ? value : undefined;
};

/**
 * The string form is retained only for already-created legacy routes. All new
 * navigation uses ScheduleSearchParams, so the payload stays explicit.
 */
export const getScheduleSearchQuery = (params: unknown): string | undefined => {
  const rawQuery = typeof params === 'string'
    ? params
    : typeof params === 'object' && params !== null && typeof (params as ScheduleSearchParams).searchQuery === 'string'
      ? (params as ScheduleSearchParams).searchQuery
      : undefined;

  const normalizedQuery = rawQuery?.trim();
  return normalizedQuery || undefined;
};
