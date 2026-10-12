import {parse, type HTMLElement} from 'node-html-parser';
import {URL} from 'react-native-url-polyfill';
import {normalizeQuestionnaireText} from './MandatoryQuestionnairesParser';
import {resolveQuestionnaireUrl, type QuestionnaireIdentity} from '../../Questionnaires/QuestionnaireUrls';

export type QuestionnaireChoice = {value: string; label: string; requiresText?: boolean};
export type QuestionnaireField = {
  kind: 'choice' | 'select' | 'text';
  qiId?: string;
  choices?: QuestionnaireChoice[];
  lookup?: 'employee';
};
export type QuestionnaireQuestionPage = {
  kind: 'question';
  postUrl: string;
  questionId: string;
  fields: QuestionnaireField[];
  verificationToken?: string;
  answered: boolean;
  unansweredUrls: string[];
  totalQuestions: number;
};
export type QuestionnaireCompletionPage = {kind: 'completion'; verificationToken?: string};

const unsupported = () => new Error('Не удалось распознать вопрос анкеты. Заполните её на сайте или сообщите разработчику.');
const usable = (node: HTMLElement) => !node.hasAttribute('disabled');
const labelOf = (root: HTMLElement, input: HTMLElement): string => {
  const id = input.getAttribute('id');
  const label = id ? root.querySelectorAll('label').find(node => node.getAttribute('for') === id) : undefined;
  return normalizeQuestionnaireText(label?.text || input.parentNode?.text || '');
};

export const ParseQuestionnaireQuestion = (
  raw: string,
  identity: QuestionnaireIdentity,
): QuestionnaireQuestionPage | QuestionnaireCompletionPage => {
  const root = parse(raw);
  const verificationToken = root.querySelector('input[name="__RequestVerificationToken"]')?.getAttribute('value')?.trim() || undefined;
  const answerButton = root.querySelectorAll('[onclick]').map(node => (
    node.getAttribute('onclick')?.match(/\beditQuestion\s*\(\s*(['"])(.*?)\1\s*,\s*(['"])1\3\s*\)/)
  )).find(Boolean);
  if (!answerButton) {
    if (/\bsubmitQuestionnaireAnswer\s*\(/.test(raw) && /SubmitQuestionnaireAnswer/.test(raw)) {
      return {kind: 'completion', verificationToken};
    }
    throw unsupported();
  }
  const postUrl = resolveQuestionnaireUrl(answerButton[2]!, identity);
  const parsedUrl = new URL(postUrl);
  const questionId = parsedUrl.searchParams.get('qID');
  if (parsedUrl.pathname !== '/bars_web/US_Q/Question/EditQuestion' || !questionId) throw unsupported();
  const fields: QuestionnaireField[] = [];
  const simpleTable = root.querySelector('#tblQuestion');
  if (simpleTable) {
    const choices: QuestionnaireChoice[] = [];
    for (const row of simpleTable.querySelectorAll('tr[data-qi]')) {
      const input = row.querySelector('input[type="radio"]');
      if (!input || !usable(input)) continue;
      const value = row.getAttribute('data-qi');
      const type = input.getAttribute('data-qit');
      if (!value || (type !== '1' && type !== '3')) throw unsupported();
      if (type === '3' && !root.querySelectorAll('textarea,input').some(node => node.getAttribute('id') === `${input.getAttribute('id')}_value`)) throw unsupported();
      choices.push({value, label: labelOf(root, input), requiresText: type === '3'});
    }
    if (!choices.length || simpleTable.querySelector('input[type="checkbox"],input[type="file"]')) throw unsupported();
    fields.push({kind: 'choice', choices});
  } else {
    const seenIds = new Set<string>();
    for (const node of root.querySelectorAll('[data-qi]')) {
      const qiId = node.getAttribute('data-qi');
      if (!qiId || seenIds.has(qiId) || !usable(node)) continue;
      if (node.tagName === 'TEXTAREA') {
        fields.push({kind: 'text', qiId});
      } else if (node.tagName === 'SELECT') {
        if (node.hasAttribute('multiple')) throw unsupported();
        const choices = node.querySelectorAll('option').filter(usable).map(option => ({
          value: option.getAttribute('value') || '', label: normalizeQuestionnaireText(option.text),
        })).filter(option => option.value !== '');
        fields.push({kind: 'select', qiId, choices, lookup: node.getAttribute('id') === 'qiEmployeeID' ? 'employee' : undefined});
      } else {
        const radios = node.querySelectorAll('input[type="radio"]').filter(usable);
        if (!radios.length) throw unsupported();
        fields.push({kind: 'choice', qiId, choices: radios.map(input => ({
          value: input.getAttribute('value') ?? '', label: labelOf(root, input),
        })).filter(option => option.value !== '')});
      }
      seenIds.add(qiId);
    }
    if (!fields.length) {
      const texts = root.querySelectorAll('textarea').filter(usable);
      if (texts.length === 1) fields.push({kind: 'text'});
    }
    if (root.querySelector('input[type="file"],input[type="checkbox"],input[type="date"]')) throw unsupported();
  }
  if (!fields.length || fields.some(field => field.kind !== 'text' && !field.choices?.length && field.lookup !== 'employee')) throw unsupported();
  const links = root.querySelectorAll('.pagination li').flatMap(item => {
    const link = item.querySelector('a');
    if (!link || link.hasAttribute('onclick')) return [];
    try {
      const url = resolveQuestionnaireUrl(link.getAttribute('href') || '', identity);
      if (new URL(url).pathname !== '/bars_web/US_Q/Question/EditQuestion') return [];
      return [{url, answered: item.classList.contains('answer-yes'), active: item.classList.contains('active')}];
    } catch { return []; }
  });
  return {
    kind: 'question', postUrl, questionId, fields, verificationToken,
    answered: links.some(link => link.active && link.answered),
    unansweredUrls: [...new Set(links.filter(link => !link.answered).map(link => link.url))],
    totalQuestions: links.length,
  };
};
