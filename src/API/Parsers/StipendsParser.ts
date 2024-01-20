import { BARSStipend } from "../DataTypes";
import {parse} from 'node-html-parser'
import {CreateBARSError, BARSError} from "../Error/Error";

export default function(raw: string): BARSStipend[] | BARSError {
  console.time('StipendsParser')
  try{
    const result: BARSStipend[] = []
    const $ = parse(raw).querySelectorAll('#div-Student__ScholarshipEvent > div > table > tbody > tr')
    for(let i of $){
      const stipend: BARSStipend = {
        start_date: i.querySelector(`td:nth-child(2)`)!.text.trim(),
        end_date: i.querySelector(`td:nth-child(3)`)!.text.trim(),
        type: i.querySelector(`td:nth-child(4)`)!.text.trim(),
        amount: i.querySelector(`td:nth-child(5)`)!.text.trim(),
        order_date: i.querySelector(`td:nth-child(6)`)!.text.trim(),
        order_number: i.querySelector(`td:nth-child(7)`)!.text.trim()
      }
      result.push(stipend)
    }
    console.timeEnd('StipendsParser')
    return result
  }catch (e: any){
    return CreateBARSError('STIPENDS_PARSER_FAIL', e)
  }
}
