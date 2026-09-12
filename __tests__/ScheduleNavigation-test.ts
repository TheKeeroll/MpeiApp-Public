import {createScheduleSearchParams, getScheduleSearchQuery} from '../src/Screens/Schedule/ScheduleNavigation';

describe('guest schedule navigation', () => {
  it('does not create a personal schedule query until the guest submits a non-empty value', () => {
    expect(getScheduleSearchQuery(undefined)).toBeUndefined();
    expect(getScheduleSearchQuery({searchQuery: '   '})).toBeUndefined();
    expect(createScheduleSearchParams('ИУ7-11')).toEqual({searchQuery: 'ИУ7-11'});
    expect(getScheduleSearchQuery(createScheduleSearchParams('  ИУ7-11  '))).toBe('ИУ7-11');
  });
});
