import {URLS} from '../Common/Constants';
import {URL} from 'react-native-url-polyfill';

export type QuestionnaireIdentity = {userId: string; answerId: string};
export const BARS_ORIGIN = 'https://bars.mpei.ru';
const QUESTIONNAIRE_PATH = '/bars_web/US_Q/';

export const getQuestionnairesUrl = (login: string): string => {
  const account = login.trim().replace('/', '\\');
  return `${BARS_ORIGIN}${QUESTIONNAIRE_PATH}QuestionnaireAnswer/ListQuestionnaireAnswer?ac=${encodeURIComponent(account.includes('\\') ? account : `public\\${account}`)}`;
};

export const getQuestionnaireIdentity = (url: string): QuestionnaireIdentity | undefined => {
  try {
    const parsed = new URL(url, URLS.BARS_MAIN);
    if (parsed.origin !== BARS_ORIGIN || !parsed.pathname.startsWith(QUESTIONNAIRE_PATH)) return;
    const userId = parsed.searchParams.get('uslkID');
    const answerId = parsed.searchParams.get('qqaID');
    if (userId && answerId) return {userId, answerId};
  } catch { /* An incomplete link still leaves the questionnaire visible for manual filling. */ }
};

export const resolveQuestionnaireUrl = (url: string, identity?: QuestionnaireIdentity, base = URLS.BARS_MAIN): string => {
  const parsed = new URL(url, base);
  const allowedPaths = ['Question/EditQuestion', 'Question/EditQuestionFirst', 'QuestionnaireAnswer/EditQuestionnaireAnswer'];
  if (parsed.origin !== BARS_ORIGIN || parsed.username || parsed.password
    || !allowedPaths.some(path => parsed.pathname === QUESTIONNAIRE_PATH + path)) {
    throw new Error('БАРС вернул неподдерживаемый адрес анкеты. Заполните её на сайте.');
  }
  if (identity && (parsed.searchParams.getAll('uslkID').length !== 1 || parsed.searchParams.getAll('qqaID').length !== 1
    || parsed.searchParams.get('uslkID') !== identity.userId
    || parsed.searchParams.get('qqaID') !== identity.answerId)) {
    throw new Error('Изменился контекст анкеты. Повторите проверку доступа.');
  }
  parsed.hash = '';
  return parsed.toString();
};

export const getFirstQuestionUrl = ({userId, answerId}: QuestionnaireIdentity): string => (
  `${BARS_ORIGIN}${QUESTIONNAIRE_PATH}Question/EditQuestionFirst?uslkID=${encodeURIComponent(userId)}&qqaID=${encodeURIComponent(answerId)}`
);

export const SUBMIT_QUESTIONNAIRE_URL = `${BARS_ORIGIN}${QUESTIONNAIRE_PATH}QuestionnaireAnswer/SubmitQuestionnaireAnswer`;

export const isUniversityUrl = (url: string): boolean => {
  try {
    const {hostname, protocol} = new URL(url);
    return (protocol === 'https:' || protocol === 'http:')
      && (hostname === 'mpei.ru' || hostname.endsWith('.mpei.ru'));
  } catch { return false; }
};
