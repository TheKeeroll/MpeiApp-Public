import {parse} from 'node-html-parser'
import {CreateBARSError, BARSError} from "../Error/Error";

export default function(raw: string, mode: 'legacy' | 'modern'): string | BARSError {
  console.log('parsing mail in ' + mode + ' mode: ' + raw);
  console.time('MailParser')
  let mail_counter = '0';
  try{
    const span_elements = parse(raw).querySelectorAll('span')
    for(let i of span_elements){
      console.log(i.text)
      if (mode == 'legacy') {
        if (i.outerHTML.includes('unrd')) {
          console.log('Legacy unread counter found - ' + i.text)
          mail_counter = i.text.replace(')', '').replace('(', '').trim()
          break
        }
      } else {
        if (i.text.includes('(')) {
          console.log('Modern unread counter found - ' + i.text)
          mail_counter = i.text.replace(')', '').replace('(', '').trim()
          break
        } else if (i.text.includes('[')) {
          console.log('Modern mail - found sign of the absence of unread')
          break
        }
      }
    }
    console.timeEnd('MailParser')
    return mail_counter
  }catch (e: any){
    return CreateBARSError('MAIL_PARSER_FAIL', e)
  }
}
