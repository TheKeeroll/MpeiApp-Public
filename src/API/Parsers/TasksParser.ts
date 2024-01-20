import { BARSTask } from "../DataTypes";
import {parse} from 'node-html-parser'
import {CreateBARSError, BARSError} from "../Error/Error";

export default function(raw: string): BARSTask[] | BARSError {
  console.time('TasksParser')
  try{
    const result: BARSTask[] = []
    const $ = parse(raw).querySelectorAll('#tbl__PartialListStudent__StudentTask > tbody > tr')
    for(let i of $){
      const task: BARSTask = {
        // type: i.querySelector(`td:nth-child(1) > a`)!.text.trim(),
        manager: i.querySelector(`td:nth-child(2)`)!.text.trim(),
        // name: i.querySelector(`td:nth-child(3)`)!.text.trim(),
        date: i.querySelector(`td:nth-child(4)`)!.text.trim(),
        semester: i.querySelector(`td:nth-child(5)`)!.text.trim(),
        discipline: i.querySelector(`td:nth-child(6)`)!.text.trim(),
        place: i.querySelector(`td:nth-child(8)`)!.text.trim(),
        status: i.querySelector(`td:nth-child(9)`)!.text.trim(),
        status_date: i.querySelector(`td:nth-child(10)`)!.text.trim(),
        status_author: i.querySelector(`td:nth-child(11)`)!.text.trim()
      }
      result.push(task)
    }
    console.timeEnd('TasksParser')
    return result
  }catch (e: any){
    return CreateBARSError('TASKS_PARSER_FAIL', e)
  }
}
