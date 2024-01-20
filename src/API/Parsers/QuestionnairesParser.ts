import { BARSQuestionnaire } from "../DataTypes";
import {parse} from 'node-html-parser'
import {CreateBARSError, BARSError} from "../Error/Error";

export default function(raw: string): BARSQuestionnaire[] | BARSError {
  console.time('QuestionnairesParser')
  try{
    const result: BARSQuestionnaire[] = []
    const $ = parse(raw).querySelectorAll('#tbl__PartialListStudent__QuestionnaireAnswer > tbody > tr')//!.querySelectorAll('tr')
    for(let i of $){
      const questionnaire: BARSQuestionnaire = {
        name: i.querySelector(`td:nth-child(1) > a`)!.text.trim(),
        description: i.querySelector(`td:nth-child(3)`)!.text.trim(),
        status: i.querySelector(`td:nth-child(4)`)!.text.trim(),
        fill_until: i.querySelector(`td:nth-child(5)`)!.text.trim(),
        completed: i.querySelector(`td:nth-child(6)`)!.text.trim()
      }
      result.push(questionnaire)
    }
    console.timeEnd('QuestionnairesParser')
    return result
  }catch (e: any){
    return CreateBARSError('QUESTIONNAIRES_PARSER_FAIL', e)
  }
}
