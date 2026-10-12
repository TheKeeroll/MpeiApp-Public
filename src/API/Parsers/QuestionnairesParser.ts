import { BARSQuestionnaire } from "../DataTypes";
import {ParseMandatoryQuestionnaires} from './MandatoryQuestionnairesParser'
import {CreateBARSError, BARSError} from "../Error/Error";

export default function(raw: string): BARSQuestionnaire[] | BARSError {
  console.time('QuestionnairesParser')
  try{
    const result: BARSQuestionnaire[] = []
    for (const row of ParseMandatoryQuestionnaires(raw).rows) {
      const questionnaire: BARSQuestionnaire = {
        name: row.name,
        description: row.description,
        status: row.status,
        fill_until: row.fillUntil,
        completed: row.completed,
        mandatory: row.mandatory,
      }
      result.push(questionnaire)
    }
    console.timeEnd('QuestionnairesParser')
    return result
  }catch (e: any){
    return CreateBARSError('QUESTIONNAIRES_PARSER_FAIL', e)
  }
}
