import { BARSReport } from "../DataTypes";
import {parse} from 'node-html-parser'
import {CreateBARSError, BARSError} from "../Error/Error";

export default function(raw: string): BARSReport[] | BARSError {
  console.time('ReportsParser')
  try{
    const result: BARSReport[] = []
    const $ = parse(raw).querySelectorAll('#tbl__PartialListStudent__StudentReport > tbody > tr')
    for(let i of $){
      const report: BARSReport = {
        semester: i.querySelector('td:nth-child(1)')!.text.trim(),
        type: i.querySelector(`td:nth-child(2) > a`)!.text.trim(),
        binding: i.querySelector(`td:nth-child(3)`)!.text.trim().split(' (')[0].trim(),
        status: i.querySelector(`td:nth-child(4)`)!.text.trim()
      }
      result.push(report)
    }
    console.timeEnd('ReportsParser')
    return result
  }catch (e: any){
    return CreateBARSError('SKIPPED_CLASSES_PARSER_FAIL', e)
  }
}
