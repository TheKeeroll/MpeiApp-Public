import {parse} from 'node-html-parser'
import {CreateBARSError, BARSError} from "../Error/Error";
import { OWAMail } from "../DataTypes";

export default function(raw: string, mode: 'legacy' | 'modern'): OWAMail | BARSError {
  console.log('parsing mail in ' + mode + ' mode: ' + raw);
  console.time('MailParser')
  let mail: OWAMail = {
    mode: mode,
    unreadCount: '0'
  }
  try{
    const span_elements = parse(raw).querySelectorAll('span')
    for(let i of span_elements){
      console.log(i.text)
      if (mode == 'legacy') {
        if (i.outerHTML.includes('unrd')) {
          console.log('Legacy unread counter found - ' + i.text)
          mail.unreadCount = i.text.replace(')', '').replace('(', '').trim()
          break
        }
      } else {
        if (i.text.includes('(')) {
          console.log('Modern unread counter found - ' + i.text)
          mail.unreadCount = i.text.replace(')', '').replace('(', '').trim()
          break
        } else if (i.text.includes('[')) {
          console.log('Modern mail - found sign of the absence of unread')
          break
        }
      }
    }
    console.timeEnd('MailParser')
    return mail
  }catch (e: any){
    return CreateBARSError('MAIL_PARSER_FAIL', e)
  }
}
