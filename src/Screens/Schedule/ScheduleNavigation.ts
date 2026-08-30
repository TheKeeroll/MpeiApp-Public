export type ScheduleSearchParams = Readonly<{
  searchQuery: string;
}>;

export type ScheduleStackParamList = {
  guestScheduleMain: undefined;
  scheduleMain: ScheduleSearchParams | undefined;
};

export const createScheduleSearchParams = (searchQuery: string): ScheduleSearchParams => ({
  searchQuery,
});

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
