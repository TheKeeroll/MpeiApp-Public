import moment from 'moment';
import type {BARSSchedule, ScheduleRequestType} from './DataTypes';
import type {BARSBrowserProfile} from '../Common/Constants';
import {getMoscowDate} from '../Common/MoscowDate';
import {CalculateRange, DealWithMeal, ParseTsMPEISchedule} from './Parsers/ScheduleParser';
import {
  classifyScheduleQuery, isValidScheduleQuery, normalizeScheduleQuery,
  parseScheduleDiscovery, rankScheduleCandidates, SCHEDULE_REQUEST_TYPES, type ScheduleCandidate,
} from './Parsers/ScheduleDiscoveryParser';

export const SCHEDULE_ORIGIN = 'https://ts.mpei.ru';
export const SCHEDULE_REQUEST_TIMEOUT_MS = 10_000;
export const SCHEDULE_SEARCH_TIMEOUT_MS = 30_000;
export class ScheduleRequestError extends Error {
  constructor(public readonly kind: 'invalid-query' | 'not-found' | 'network' | 'timeout' | 'cancelled' | 'invalid-response') {
    const messages = {
      'invalid-query': 'Для поиска расписания введите не менее 3 символов.',
      'not-found': 'По указанным данным расписание не найдено. Уточните группу, преподавателя или аудиторию.',
      network: 'Не удалось загрузить расписание. Проверьте подключение и попробуйте ещё раз.',
      timeout: 'Сервер расписаний не ответил вовремя. Попробуйте ещё раз.',
      cancelled: 'Поиск расписания отменён.',
      'invalid-response': 'Сервер расписаний вернул неожиданный ответ. Попробуйте ещё раз позже.',
    };
    super(messages[kind]);
    this.name = 'ScheduleRequestError';
  }
}

type Options = {
  query: string;
  browserProfile: BARSBrowserProfile;
  type?: ScheduleRequestType;
  signal?: AbortSignal;
  personal?: boolean;
  now?: Date;
  fetcher?: typeof fetch;
};

/** Public timetable requests never pass through the authenticated BARS transport. */
export const searchSchedule = async (options: Options): Promise<BARSSchedule> => {
  const query = normalizeScheduleQuery(options.query);
  if (!isValidScheduleQuery(query)) throw new ScheduleRequestError('invalid-query');
  const operation = new AbortController();
  let deadlineExpired = false;
  const cancel = () => operation.abort();
  if (options.signal?.aborted) throw new ScheduleRequestError('cancelled');
  options.signal?.addEventListener('abort', cancel, {once: true});
  const timer = setTimeout(() => { deadlineExpired = true; operation.abort(); }, SCHEDULE_SEARCH_TIMEOUT_MS);
  const now = options.now ?? new Date();
  const today = moment(getMoscowDate(now), 'DD.MM.YYYY');
  const range = CalculateRange(today.toDate());
  const headers = {
    ...options.browserProfile,
    accept: 'application/json, text/plain, */*',
    'accept-language': 'ru,en;q=0.9',
    referer: `${SCHEDULE_ORIGIN}/ruz/main`,
  };

  const request = async (path: string): Promise<unknown> => {
    if (operation.signal.aborted) throw new ScheduleRequestError(deadlineExpired ? 'timeout' : 'cancelled');
    const controller = new AbortController();
    let requestTimer: ReturnType<typeof setTimeout> | undefined;
    let onAbort = () => {};
    const interrupted = new Promise<never>((_, reject) => {
      onAbort = () => { reject(new ScheduleRequestError(deadlineExpired ? 'timeout' : 'cancelled')); controller.abort(); };
      operation.signal.addEventListener('abort', onAbort, {once: true});
      requestTimer = setTimeout(() => {
        reject(new ScheduleRequestError('timeout'));
        controller.abort();
      }, SCHEDULE_REQUEST_TIMEOUT_MS);
    });
    try {
      return await Promise.race([
        (async () => {
          const response = await (options.fetcher ?? fetch)(SCHEDULE_ORIGIN + path, {
            method: 'GET', headers, credentials: 'omit', signal: controller.signal,
          });
          if (!response.ok) throw new ScheduleRequestError('network');
          const contentType = response.headers?.get('content-type');
          if (contentType && !contentType.includes('json')) throw new ScheduleRequestError('invalid-response');
          let data: unknown;
          try { data = await response.json(); }
          catch { throw new ScheduleRequestError('invalid-response'); }
          if (controller.signal.aborted) throw new ScheduleRequestError('cancelled');
          return data;
        })(), interrupted,
      ]);
    } catch (error) {
      if (error instanceof ScheduleRequestError) throw error;
      throw new ScheduleRequestError('network');
    } finally {
      clearTimeout(requestTimer);
      operation.signal.removeEventListener('abort', onAbort);
    }
  };

  try {
    const initial = options.personal ? 'group' : options.type ?? classifyScheduleQuery(query);
    const fallback = !options.personal && query.length < 5;
    const types = [initial, ...(fallback ? SCHEDULE_REQUEST_TYPES.filter(type => type !== initial) : [])]
      .filter(type => type !== 'person' || !/\d/.test(query));
    let firstEmpty: BARSSchedule | undefined;
    for (const type of types) {
      const directory = await request(`/api/search?term=${encodeURIComponent(query)}&type=${type}`);
      let candidates: ScheduleCandidate[];
      try {
        candidates = rankScheduleCandidates(parseScheduleDiscovery(directory, type), query, today.year(), options.personal);
      } catch { throw new ScheduleRequestError('invalid-response'); }
      for (const candidate of candidates.slice(0, fallback ? 3 : 1)) {
        const start = options.personal ? moment(range[0]) : today;
        const rows = await request(`/api/schedule/${type}/${encodeURIComponent(candidate.id)}?start=${start.format('YYYY.MM.DD')}&finish=${moment(range[1]).format('YYYY.MM.DD')}&lng=1`);
        let schedule: BARSSchedule;
        try { schedule = ParseTsMPEISchedule(rows, today.format('DD.MM.YYYY')); }
        catch { throw new ScheduleRequestError('invalid-response'); }
        const hasLessons = schedule.days.some(day => day.lessons.length > 0);
        schedule.scheduleName = candidate.label;
        schedule.scheduleTarget = {id: candidate.id, type: candidate.type};
        if (hasLessons) return DealWithMeal(schedule);
        firstEmpty ??= schedule;
      }
    }
    if (firstEmpty) return firstEmpty;
    throw new ScheduleRequestError('not-found');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
};
