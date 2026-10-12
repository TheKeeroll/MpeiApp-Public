import {parse} from 'node-html-parser';
import {URL} from 'react-native-url-polyfill';
import {getQuestionnaireIdentity, BARS_ORIGIN} from '../../Questionnaires/QuestionnaireUrls';

export type MandatoryQuestionnaire = {
  name: string;
  description: string;
  status: string;
  fillUntil: string;
  completed: string;
  mandatory: boolean;
  id?: string;
  userId?: string;
  viewUrl?: string;
};

export type QuestionnairePagination = {
  page: number;
  pageSize: number;
  total?: number;
  nextPage?: number;
  partialUrl?: string;
  sortOrder?: string;
  id: string | null;
  state: string | null;
};

export type MandatoryQuestionnairesPage = {
  requiresCompletion: boolean;
  reason?: string;
  questionnaires: MandatoryQuestionnaire[];
  rows: MandatoryQuestionnaire[];
  hasTable: boolean;
  listComplete: boolean;
  pagination?: QuestionnairePagination;
  authMode?: 'login' | '2FA';
};

export const normalizeQuestionnaireText = (value: string): string => value.replace(/\s+/gu, ' ').trim();
const comparable = (value: string) => normalizeQuestionnaireText(value).toLocaleLowerCase('ru').replace(/ё/g, 'е');
export const isQuestionnaireCompleted = (status: string): boolean => /заверш|заполнен/u.test(comparable(status))
  && !/(?:не|не было)\s+(?:заверш|заполн)/u.test(comparable(status));
export const isQuestionnaireExpired = (status: string): boolean => /истек|просроч|недоступ/u.test(comparable(status));
export const isBlockingQuestionnaire = (row: MandatoryQuestionnaire): boolean => (
  row.mandatory && !isQuestionnaireCompleted(row.status) && !isQuestionnaireExpired(row.status) && !row.completed
);

const emptyPage = (): MandatoryQuestionnairesPage => ({
  requiresCompletion: false, questionnaires: [], rows: [], hasTable: false, listComplete: false,
});
const positiveNumber = (value: string | undefined, fallback: number): number => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

export const ParseMandatoryQuestionnaires = (raw: string): MandatoryQuestionnairesPage => {
  const result = emptyPage();
  // Ordinary JSON and large marks pages do not need an additional DOM parse.
  if (/^[\s\uFEFF]*[\[{]/u.test(raw) || !/divAlert|tbl__PartialListQuestionnaireAnswer|AF2_Code|Password/i.test(raw)) return result;
  const root = parse(raw);
  for (const form of root.querySelectorAll('form')) {
    const action = form.getAttribute('action') || '';
    if (form.querySelector('input[name="AF2_Code"]') && (!action || /Auth\/LoginCode/i.test(action))) {
      return {...result, authMode: '2FA'};
    }
    if (form.querySelector('input[name="Password"]') && form.querySelector('input[name="Account"]')
      && (!action || /\/bars_web\/?(?:[?#].*)?$|\/Auth\/Login(?:[?#].*)?$/i.test(action))) {
      return {...result, authMode: 'login'};
    }
  }
  const banner = root.querySelector('#divAlert');
  const reason = normalizeQuestionnaireText(banner?.text || '');
  const bannerText = comparable(reason);
  const blockedByBanner = /продолжени\w*/u.test(bannerText) && /работ/u.test(bannerText)
    && /заполн/u.test(bannerText) && /обязательн/u.test(bannerText) && /анкет/u.test(bannerText);
  const table = root.querySelector('#tbl__PartialListQuestionnaireAnswer');
  result.hasTable = Boolean(table);
  for (const tr of table?.querySelectorAll('tbody > tr') || []) {
    const cells = tr.querySelectorAll('td');
    if (!cells[0]) continue;
    const mandatory = Boolean(cells[0].querySelector('.bi.bi-exclamation-circle-fill'));
    if (cells.length < 6 && !mandatory) continue;
    const link = cells[0]!.querySelector('a[title="Просмотр"]') || cells[0]!.querySelector('a');
    const name = normalizeQuestionnaireText(link?.text || cells[0]!.text);
    if (!name) continue;
    const href = link?.getAttribute('href');
    let viewUrl: string | undefined;
    try {
      if (href) {
        const url = new URL(href, BARS_ORIGIN);
        if (url.origin === BARS_ORIGIN && url.pathname === '/bars_web/US_Q/QuestionnaireAnswer/EditQuestionnaireAnswer') viewUrl = url.toString();
      }
    } catch { /* Titles remain useful even when the server omitted a usable link. */ }
    const identity = viewUrl ? getQuestionnaireIdentity(viewUrl) : undefined;
    result.rows.push({
      name, description: normalizeQuestionnaireText(cells[2]?.text || ''), status: normalizeQuestionnaireText(cells[3]?.text || ''),
      fillUntil: normalizeQuestionnaireText(cells[4]?.text || ''), completed: normalizeQuestionnaireText(cells[5]?.text || ''),
      mandatory,
      id: identity?.answerId, userId: identity?.userId, viewUrl,
    });
  }
  result.questionnaires = result.rows.filter(isBlockingQuestionnaire);
  result.requiresCompletion = blockedByBanner || result.questionnaires.length > 0;
  if (blockedByBanner) result.reason = reason;
  if (table) {
    const pager = root.querySelector('#QuestionnaireAnswer_Pager');
    const totalText = normalizeQuestionnaireText(pager?.querySelector('.pager-size')?.text || pager?.text || '');
    const totalMatch = totalText.match(/из\s+([\d ]+)/u);
    const total = totalMatch ? Number(totalMatch[1]!.replace(/\s/g, '')) : undefined;
    const page = positiveNumber(table.getAttribute('data-q-page'), 1);
    const pageSize = positiveNumber(table.getAttribute('data-q-page-size'), 10);
    const next = pager?.querySelector('a[rel="next"]')?.getAttribute('href');
    const nextPageFromLink = next?.replace(/[?#].*$/, '').match(/\/(\d+)\/?$/)?.[1];
    const nextPage = nextPageFromLink ? Number(nextPageFromLink)
      : total !== undefined && page * pageSize < total ? page + 1 : undefined;
    let partialUrl: string | undefined;
    try {
      const href = table.getAttribute('data-q-href');
      if (href) {
        const url = new URL(href, BARS_ORIGIN);
        if (url.origin === BARS_ORIGIN && url.pathname === '/bars_web/US_Q/QuestionnaireAnswer/_PartialListQuestionnaireAnswer') partialUrl = url.toString();
      }
    } catch { /* A complete list can still be displayed without a pagination URL. */ }
    result.pagination = {
      page, pageSize, total, nextPage, partialUrl, sortOrder: table.getAttribute('data-q-sort-order'),
      id: table.getAttribute('data-q-id') ?? null, state: table.getAttribute('data-q-state') ?? null,
    };
    result.listComplete = page === 1 && !nextPage && (total === undefined || result.rows.length >= total);
  }
  return result;
};
