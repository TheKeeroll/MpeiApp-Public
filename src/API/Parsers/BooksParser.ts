import { BARSBook, BARSBooksPack } from "../DataTypes";
import {parse} from 'node-html-parser'
import {CreateBARSError, BARSError} from "../Error/Error";

export default function(raw: string): BARSBooksPack | BARSError {
  console.time('BooksParser')
  try{
    const books_list: BARSBook[] = []
    const $ = parse(raw).querySelectorAll('#tbl__PartialListStudent__BookCopy > tbody > tr')//!.querySelectorAll('tr')
    for(let i of $){
      const book: BARSBook = {
        name: i.querySelector(`td:nth-child(1)`)!.text.trim(),
        author: i.querySelector(`td:nth-child(2)`)!.text.trim(),
        code: i.querySelector(`td:nth-child(3)`)!.text.trim(),
        return_until: i.querySelector(`td:nth-child(4)`)!.text.trim(),
      }
      books_list.push(book)
    }
    const raw_library_card = parse(raw).querySelector('#div-Student__BookCopy > div > div > div > span')!.text.trim()
    console.log(raw_library_card)
    const result: BARSBooksPack = {
      books: books_list,
      library_card: raw_library_card.split(' ')[5],
    }
    console.timeEnd('BooksParser')
    return result
  }catch (e: any){
    return CreateBARSError('BOOKS_PARSER_FAIL', e)
  }
}
