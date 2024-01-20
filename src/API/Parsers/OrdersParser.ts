import { BARSOrder } from "../DataTypes";
import {parse} from 'node-html-parser'
import {CreateBARSError, BARSError} from "../Error/Error";

export default function(raw: string): BARSOrder[] | BARSError {
  console.time('OrdersParser')
  try{
    const result: BARSOrder[] = []
    const $ = parse(raw).querySelectorAll('#div-Student__Thanks > div > table> tbody > tr')
    for(let i of $){
      const order: BARSOrder = {
        num: i.querySelector(`td:nth-child(1)`)!.text.trim(),
        date: i.querySelector(`td:nth-child(2)`)!.text.trim(),
        content: i.querySelector(`td:nth-child(3)`)!.text.trim()
      }
      result.push(order)
    }
    console.timeEnd('OrdersParser')
    return result
  }catch (e: any){
    return CreateBARSError('ORDERS_PARSER_FAIL', e)
  }
}
