import { BARSBook, BARSBooksPack } from "../DataTypes";
import {parse} from 'node-html-parser'
import {CreateBARSError, BARSError} from "../Error/Error";

export default function(raw: string): BARSBooksPack | BARSError {
  console.time('BooksParser')
  try{
    const books_list: BARSBook[] = []
    const $ = parse(raw).querySelectorAll('#tbl__PartialListStudent__BookCopy > tbody > tr')//!.querySelectorAll('tr')
    for(let i of $){
      let raw_book_name = i.querySelector(`td:nth-child(1)`)!.text.trim()
      if (raw_book_name.includes('просрочено')){
        raw_book_name = raw_book_name.replace('просрочено', '').trim()
        console.log('raw_book_name = ' + raw_book_name);
      }
      const book: BARSBook = {
        name: raw_book_name,
        author: i.querySelector(`td:nth-child(2)`)!.text.trim(),
        code: i.querySelector(`td:nth-child(3)`)!.text.trim(),
        return_until: i.querySelector(`td:nth-child(4)`)!.text.trim(),
      }
      books_list.push(book)
    }
    let raw_library_card = 'i n i t | empty'
    try {
      raw_library_card = parse(raw).querySelector('#div-Student__BookCopy > div > div > div > span')!.text.trim()
      console.log(raw_library_card)
    }catch (e: any){
      console.warn("raw_library_card failed: " + e.toString())
    }

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
