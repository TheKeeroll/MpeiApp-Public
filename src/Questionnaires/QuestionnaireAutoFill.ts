import {ParseQuestionnaireQuestion, type QuestionnaireChoice, type QuestionnaireField} from '../API/Parsers/QuestionnaireQuestionParser';
import type {MandatoryQuestionnaire} from '../API/Parsers/MandatoryQuestionnairesParser';
import {getFirstQuestionUrl, resolveQuestionnaireUrl, type QuestionnaireIdentity} from './QuestionnaireUrls';
import {QuestionnaireOperationCancelledError} from './QuestionnaireErrors';

export type QuestionnaireAutoFillProgress = {
  questionnaireName: string;
  questionnaireIndex: number;
  questionnaireCount: number;
  answeredQuestions: number;
};
export type QuestionnaireAutoFillTransport = {
  get: (url: string) => Promise<string>;
  answer: (url: string, value: string, token?: string) => Promise<unknown>;
  submit: (identity: QuestionnaireIdentity, token?: string) => Promise<unknown>;
  verifyCompleted: (identity: QuestionnaireIdentity) => Promise<boolean>;
  lookupEmployee: (identity: QuestionnaireIdentity, qiId: string) => Promise<QuestionnaireChoice[]>;
};

const TEXT_ANSWERS = ['-', '   ', 'Затрудняюсь ответить'] as const;
const randomItem = <T,>(values: readonly T[], random: () => number): T => {
  if (!values.length) throw new Error('БАРС не предоставил допустимых вариантов ответа.');
  return values[Math.max(0, Math.min(values.length - 1, Math.floor(random() * values.length)))]!;
};
export const neutralAnswerPriority = (label: string): number => {
  const text = label.replace(/\s+/gu, ' ').trim().toLocaleLowerCase('ru').replace(/ё/g, 'е');
  if (text.includes('затрудняюсь ответить')) return 0;
  if (/(?:^|[^\p{L}])не знаю(?:$|[^\p{L}])/u.test(text)) return 1;
  if (/(?:^|[^\p{L}])не знал(?:\(а\)|а)?(?:$|[^\p{L}])/u.test(text)) return 2;
  if (/(?:^|[^\p{L}])нет(?:$|[^\p{L}])/u.test(text)) return 3;
  return Infinity;
};
export const chooseQuestionnaireChoice = (choices: QuestionnaireChoice[], random: () => number = Math.random): QuestionnaireChoice => {
  const priority = Math.min(...choices.map(choice => neutralAnswerPriority(choice.label)));
  return randomItem(choices.filter(choice => neutralAnswerPriority(choice.label) === priority), random);
};
export const makeQuestionnaireAnswer = (fields: QuestionnaireField[], random: () => number = Math.random): string => fields.map(field => {
  let value: string;
  if (field.kind === 'text') value = randomItem(TEXT_ANSWERS, random);
  else {
    const choice = chooseQuestionnaireChoice(field.choices || [], random);
    value = choice.value + (choice.requiresText ? `|p|${randomItem(TEXT_ANSWERS, random)}` : '');
  }
  return field.qiId ? `${field.qiId}|p|${value}` : value;
}).join('|a|');

const resultObject = (value: unknown): Record<string, unknown> => (
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
);
const serverError = (result: Record<string, unknown>, fallback: string): Error => new Error(
  typeof result.error === 'string' && result.error.trim() ? result.error.trim() : fallback,
);

export const fillMandatoryQuestionnaires = async (
  questionnaires: MandatoryQuestionnaire[],
  transport: QuestionnaireAutoFillTransport,
  isCurrent: () => boolean,
  onProgress: (progress: QuestionnaireAutoFillProgress) => void,
  random: () => number = Math.random,
): Promise<void> => {
  const assertCurrent = () => { if (!isCurrent()) throw new QuestionnaireOperationCancelledError(); };
  if (questionnaires.length > 50) throw new Error('Слишком много обязательных анкет для одного автоматического запуска. Заполните их на сайте.');
  for (const [index, questionnaire] of questionnaires.entries()) {
    assertCurrent();
    if (!questionnaire.mandatory || !questionnaire.id || !questionnaire.userId || !questionnaire.viewUrl) {
      throw new Error('Не удалось получить данные обязательной анкеты. Заполните её на сайте.');
    }
    const identity = {userId: questionnaire.userId, answerId: questionnaire.id};
    let url = getFirstQuestionUrl(identity);
    let answeredQuestions = 0;
    let finished = false;
    const visited = new Set<string>();
    const answered = new Set<string>();
    for (let step = 0; step < 200; step++) {
      assertCurrent();
      url = resolveQuestionnaireUrl(url, identity);
      if (visited.has(url)) throw new Error('БАРС повторно открыл тот же вопрос. Автозаполнение остановлено; проверьте анкету на сайте.');
      visited.add(url);
      onProgress({questionnaireName: questionnaire.name, questionnaireIndex: index + 1, questionnaireCount: questionnaires.length, answeredQuestions});
      const raw = await transport.get(url);
      assertCurrent();
      const page = ParseQuestionnaireQuestion(raw, identity);
      if (page.kind === 'completion') {
        const result = resultObject(await transport.submit(identity, page.verificationToken));
        assertCurrent();
        if (result.success === false || (typeof result.error === 'string' && result.error.trim())) throw serverError(result, 'БАРС не подтвердил завершение анкеты.');
        const completed = await transport.verifyCompleted(identity);
        assertCurrent();
        if (!completed) throw new Error('БАРС пока не отметил анкету завершённой. Проверьте её на сайте и повторите проверку доступа.');
        finished = true;
        break;
      }
      if (page.answered) {
        url = page.unansweredUrls.find(next => !visited.has(next)) || questionnaire.viewUrl;
        continue;
      }
      if (answered.has(page.questionId)) throw new Error('БАРС повторил уже сохранённый вопрос. Автозаполнение остановлено.');
      for (const field of page.fields) {
        if (field.lookup === 'employee' && !field.choices?.length && field.qiId) {
          field.choices = await transport.lookupEmployee(identity, field.qiId);
          assertCurrent();
        }
      }
      const answer = makeQuestionnaireAnswer(page.fields, random);
      assertCurrent();
      const result = resultObject(await transport.answer(page.postUrl, answer, page.verificationToken));
      assertCurrent();
      if (result.success !== true) throw serverError(result, 'БАРС не принял ответ. Заполните анкету на сайте.');
      answered.add(page.questionId);
      answeredQuestions += 1;
      if (typeof result.url !== 'string' || !result.url.trim()) throw new Error('БАРС не сообщил адрес следующего вопроса. Проверьте анкету на сайте.');
      url = resolveQuestionnaireUrl(result.url, identity, page.postUrl);
    }
    if (!finished) throw new Error('Превышен предел вопросов анкеты. Продолжите заполнение на сайте.');
  }
};
