import type {MandatoryQuestionnaire} from '../API/Parsers/MandatoryQuestionnairesParser';
import type {QuestionnaireAutoFillProgress} from './QuestionnaireAutoFill';

export const MANDATORY_QUESTIONNAIRES_EVENT = 'MandatoryQuestionnairesChanged';
export type MandatoryQuestionnairesSnapshot = {
  generation?: number;
  enabled: boolean;
  status: 'idle' | 'loading' | 'filling' | 'checking';
  questionnaires: MandatoryQuestionnaire[];
  listComplete: boolean;
  reason?: string;
  error?: string;
  progress?: QuestionnaireAutoFillProgress;
};
export const emptyMandatoryQuestionnairesSnapshot = (enabled: boolean): MandatoryQuestionnairesSnapshot => ({
  enabled, status: 'idle', questionnaires: [], listComplete: false,
  generation: undefined, reason: undefined, error: undefined, progress: undefined,
});
