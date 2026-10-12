/// <reference types="node" />
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ParseQuestionnaireQuestion} from '../src/API/Parsers/QuestionnaireQuestionParser';
import {ParseMandatoryQuestionnaires} from '../src/API/Parsers/MandatoryQuestionnairesParser';
import {chooseQuestionnaireChoice, fillMandatoryQuestionnaires, makeQuestionnaireAnswer, neutralAnswerPriority, type QuestionnaireAutoFillTransport} from '../src/Questionnaires/QuestionnaireAutoFill';
import {QuestionnaireOperationCancelledError} from '../src/Questionnaires/QuestionnaireErrors';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures/bars-questions', name), 'utf8');
const questionnaire = ParseMandatoryQuestionnaires(readFileSync(join(__dirname, 'fixtures/bars-questionnaires/blocked-page-1.html'), 'utf8')).questionnaires[0]!;
const identity = {userId: questionnaire.userId!, answerId: questionnaire.id!};
const url = (question: number) => `https://bars.mpei.ru/bars_web/US_Q/Question/EditQuestion?uslkID=${identity.userId}&qqaID=${identity.answerId}&qID=${question}`;
const transport = (): QuestionnaireAutoFillTransport & {get: jest.Mock; answer: jest.Mock; submit: jest.Mock; verifyCompleted: jest.Mock} => ({
  get: jest.fn(async () => fixture('radio-neutral.html')),
  answer: jest.fn(async () => ({success: true, url: questionnaire.viewUrl})),
  submit: jest.fn(async () => ({success: true})),
  verifyCompleted: jest.fn(async () => true),
  lookupEmployee: jest.fn(async () => []),
});

describe('experimental questionnaire answers', () => {
  it.each(['Затрудняюсь ответить', 'НЕ ЗНАЮ', 'не знал(а)', 'Не знала', 'Нет, не планирую'])('prefers the neutral answer %s', label => {
    expect(chooseQuestionnaireChoice([{value: 'yes', label: 'Да'}, {value: 'neutral', label}], () => 0).value).toBe('neutral');
  });

  it('does not treat Интернет as Нет and selects random valid choices when no neutral answer exists', () => {
    expect(neutralAnswerPriority('Интернет')).toBe(Infinity);
    expect(chooseQuestionnaireChoice([{value: 'one', label: 'Студент'}, {value: 'two', label: 'Выпускник'}], () => 0.9).value).toBe('two');
  });

  it('reads the real simple-radio structure and preserves the required choice with its text parameter', () => {
    const page = ParseQuestionnaireQuestion(fixture('radio-neutral.html'), identity);
    expect(page.kind).toBe('question');
    if (page.kind === 'question') expect(makeQuestionnaireAnswer(page.fields, () => 0)).toBe('1864');
    const other = ParseQuestionnaireQuestion(fixture('other-with-text.html'), identity);
    if (other.kind === 'question') expect(makeQuestionnaireAnswer(other.fields, () => 0)).toBe('501|p|-');
  });

  it('serializes select, rating and text as the form getAnswer function does', () => {
    const page = ParseQuestionnaireQuestion(fixture('composite-fields.html'), identity);
    if (page.kind !== 'question') throw new Error('Expected question');
    expect(makeQuestionnaireAnswer(page.fields, () => 0)).toBe('628|p|20000000-0000-4000-8000-000000000001|a|629|p|-|a|630|p|-');
    expect(page.fields).toHaveLength(3);
  });

  it.each([0, 0.4, 0.9])('preserves the allowed text answer selected with random=%s', random => {
    const page = ParseQuestionnaireQuestion(fixture('free-text.html'), identity);
    if (page.kind !== 'question') throw new Error('Expected question');
    const expected = random === 0 ? '-' : random === 0.4 ? '   ' : 'Затрудняюсь ответить';
    expect(makeQuestionnaireAnswer(page.fields, () => random)).toBe(`630|p|${expected}`);
  });

  it('follows server URLs with nonconsecutive IDs, saves all answers, and confirms completion', async () => {
    const api = transport();
    api.get.mockImplementation(async (address: string) => {
      if (address.includes('EditQuestionFirst')) return fixture('radio-first.html');
      if (address.includes('qID=709')) return fixture('radio-neutral.html').replaceAll('qID=700', 'qID=709');
      if (address.includes('qID=713')) return fixture('free-text.html');
      return fixture('completion.html');
    });
    api.answer.mockResolvedValueOnce({success: true, url: url(709)})
      .mockResolvedValueOnce({success: true, url: `EditQuestion?uslkID=${identity.userId}&qqaID=${identity.answerId}&qID=713`})
      .mockResolvedValueOnce({success: true, url: questionnaire.viewUrl});
    const progress = jest.fn();
    await fillMandatoryQuestionnaires([questionnaire], api, () => true, progress, () => 0);
    expect(api.answer.mock.calls.map(call => call[1])).toEqual(['1851', '1864', '630|p|-']);
    expect(api.submit).toHaveBeenCalledWith(identity, undefined);
    expect(api.verifyCompleted).toHaveBeenCalledWith(identity);
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({answeredQuestions: 3}));
  });

  it('does not submit the questionnaire if an answer was rejected', async () => {
    const api = transport();
    api.answer.mockResolvedValue({success: false, error: 'Необходимо ответить на вопрос'});
    await expect(fillMandatoryQuestionnaires([questionnaire], api, () => true, jest.fn())).rejects.toThrow('Необходимо ответить');
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('preserves answers already marked as saved and only confirms the questionnaire', async () => {
    const api = transport();
    api.get.mockResolvedValueOnce(fixture('radio-first.html').replace(/(class="page-item[^\"]*)answer-no/g, '$1answer-yes'))
      .mockResolvedValueOnce(fixture('completion.html'));
    await fillMandatoryQuestionnaires([questionnaire], api, () => true, jest.fn());
    expect(api.answer).not.toHaveBeenCalled();
    expect(api.submit).toHaveBeenCalledTimes(1);
  });

  it('stops after an in-flight request when the account or operation is cancelled', async () => {
    let current = true;
    const api = transport();
    api.answer.mockImplementation(async () => { current = false; return {success: true, url: url(713)}; });
    await expect(fillMandatoryQuestionnaires([questionnaire], api, () => current, jest.fn())).rejects.toBeInstanceOf(QuestionnaireOperationCancelledError);
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('rejects unknown fields before writing and rejects cross-account server URLs', async () => {
    const api = transport();
    api.get.mockResolvedValue(fixture('unsupported-file.html'));
    await expect(fillMandatoryQuestionnaires([questionnaire], api, () => true, jest.fn())).rejects.toThrow('распознать');
    expect(api.answer).not.toHaveBeenCalled();
    api.get.mockResolvedValue(fixture('radio-neutral.html'));
    api.answer.mockResolvedValue({success: true, url: url(713).replace(identity.answerId, 'other-account')});
    await expect(fillMandatoryQuestionnaires([questionnaire], api, () => true, jest.fn())).rejects.toThrow('контекст');
  });

  it('detects repeated questions and does not mistake an HTTP success for questionnaire completion', async () => {
    const api = transport();
    api.answer.mockResolvedValue({success: true, url: url(700)});
    await expect(fillMandatoryQuestionnaires([questionnaire], api, () => true, jest.fn())).rejects.toThrow('повторил');
    expect(api.answer).toHaveBeenCalledTimes(1);
    api.get.mockResolvedValue(fixture('completion.html'));
    api.verifyCompleted.mockResolvedValue(false);
    await expect(fillMandatoryQuestionnaires([questionnaire], api, () => true, jest.fn())).rejects.toThrow('не отметил');
  });
});
