import { BARSStipend, BARSStipendPetition, BARSStipendsPack } from "../DataTypes";
import {parse} from 'node-html-parser'
import {CreateBARSError, BARSError} from "../Error/Error";

export default function(raw: string): BARSStipendsPack | BARSError {
  console.time('StipendsParser')
  try{
    const stipends: BARSStipend[] = []
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
      stipends.push(stipend)
    }
    const petitions: BARSStipendPetition[] = []
    const $2 = parse(raw).querySelectorAll('#div-Student__ScholarshipStatement > div > table > tbody > tr')
    for(let j of $2){
      const petition: BARSStipendPetition = {
        term: j.querySelector(`td:nth-child(1)`)!.text.trim(),
        wave: j.querySelector(`td:nth-child(2)`)!.text.trim(),
        type: j.querySelector(`td:nth-child(3)`)!.text.trim(),
        sub_date: j.querySelector(`td:nth-child(4)`)!.text.trim(),
        average_grade: j.querySelector(`td:nth-child(6)`)!.text.trim(),
        total: j.querySelector(`td:nth-child(10)`)!.text.trim(),
        calc_date: j.querySelector(`td:nth-child(11)`)!.text.trim(),
      }
      petitions.push(petition)
      console.log(petition)
    }
    const res: BARSStipendsPack = {
      stipends: stipends,
      petitions: petitions,
    }
    console.timeEnd('StipendsParser')
    return res
  }catch (e: any){
    return CreateBARSError('STIPENDS_PARSER_FAIL', e)
  }
}
