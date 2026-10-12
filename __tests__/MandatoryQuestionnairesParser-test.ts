/// <reference types="node" />
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {ParseMandatoryQuestionnaires} from '../src/API/Parsers/MandatoryQuestionnairesParser';
import QuestionnairesParser from '../src/API/Parsers/QuestionnairesParser';
import {getQuestionnairesUrl, resolveQuestionnaireUrl, isUniversityUrl} from '../src/Questionnaires/QuestionnaireUrls';

const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures/bars-questionnaires', name), 'utf8');
const cases = JSON.parse(fixture('cases.json')) as Array<{
  file: string; classification: string; rows: number; requiredAnswerIds: string[];
  pagination: {page: number; pageSize: number; total: number; hasNext: boolean} | null;
}>;

describe('mandatory questionnaire detection', () => {
  it.each(cases)('classifies $file without confusing ordinary or expired questionnaires', expected => {
    const page = ParseMandatoryQuestionnaires(fixture(expected.file));
    expect(page.requiresCompletion).toBe(expected.classification === 'required');
    expect(page.authMode).toBe(['login', '2FA'].includes(expected.classification) ? expected.classification : undefined);
    expect(page.rows).toHaveLength(expected.rows);
    expect(page.questionnaires.map(row => row.id)).toEqual(expected.requiredAnswerIds);
    if (expected.pagination) {
      expect(page.pagination).toMatchObject({page: expected.pagination.page, pageSize: expected.pagination.pageSize, total: expected.pagination.total});
      expect(Boolean(page.pagination?.nextPage)).toBe(expected.pagination.hasNext);
    }
  });

  it('keeps identical names separate and decodes entities', () => {
    const page = ParseMandatoryQuestionnaires(fixture('required-without-banner.html'));
    expect(page.questionnaires[0]?.name).toBe('Обязательная анкета & условия доступа');
    expect(page.questionnaires[0]?.description).toBe('Тестовая группа "А".');
    expect(page.questionnaires[0]?.id).not.toBe(page.questionnaires[1]?.id);
  });

  it('handles an unfilled status and a total with thousands separators', () => {
    const raw = fixture('blocked-page-1.html').replaceAll('необходимо заполнить', 'не заполнено').replace('из 18', 'из 1 018');
    const page = ParseMandatoryQuestionnaires(raw);
    expect(page.questionnaires).toHaveLength(1);
    expect(page.pagination?.total).toBe(1018);
    expect(page.listComplete).toBe(false);
  });

  it('prioritizes an expired-session form over questionnaire decoration', () => {
    const page = ParseMandatoryQuestionnaires(fixture('login-form.html') + fixture('blocked-page-1.html'));
    expect(page.authMode).toBe('login');
    expect(page.requiresCompletion).toBe(false);
  });

  it('does not interpret HTML stored inside ordinary JSON as a redirect', () => {
    expect(ParseMandatoryQuestionnaires(JSON.stringify({html: fixture('blocked-page-1.html')})).requiresCompletion).toBe(false);
  });

  it('still recognizes a required row when some descriptive columns are missing', () => {
    const page = ParseMandatoryQuestionnaires('<table id="tbl__PartialListQuestionnaireAnswer"><tbody><tr><td><i class="bi bi-exclamation-circle-fill"></i><a>Обязательная анкета</a></td></tr></tbody></table>');
    expect(page.requiresCompletion).toBe(true);
    expect(page.questionnaires[0]?.name).toBe('Обязательная анкета');
    expect(page.questionnaires[0]?.id).toBeUndefined();
  });

  it('adds optional mandatory flags to ordinary questionnaire data', () => {
    const rows = QuestionnairesParser(fixture('blocked-page-1.html'));
    expect(Array.isArray(rows)).toBe(true);
    if (Array.isArray(rows)) {
      expect(rows.filter(row => row.mandatory)).toHaveLength(1);
      expect(rows[0]?.mandatory).toBe(false);
      expect(rows).toHaveLength(10);
    }
  });

  it('encodes a qualified account once and refuses redirects outside the questionnaire account', () => {
    expect(getQuestionnairesUrl('TestStudent')).toBe(getQuestionnairesUrl('public\\TestStudent'));
    expect(getQuestionnairesUrl('public\\TestStudent')).toContain('ac=public%5CTestStudent');
    expect(isUniversityUrl('https://bars.mpei.ru.attacker.example/')).toBe(false);
    expect(() => resolveQuestionnaireUrl('//attacker.example/bars_web/US_Q/Question/EditQuestion')).toThrow();
    expect(() => resolveQuestionnaireUrl('/bars_web/US_Q/Question/EditQuestion?uslkID=other&qqaID=one', {userId: 'student', answerId: 'one'})).toThrow();
    expect(resolveQuestionnaireUrl('/bars_web/US_Q/Question/EditQuestion?uslkID=student&qqaID=one#', {userId: 'student', answerId: 'one'})).toBe('https://bars.mpei.ru/bars_web/US_Q/Question/EditQuestion?uslkID=student&qqaID=one');
  });
});
