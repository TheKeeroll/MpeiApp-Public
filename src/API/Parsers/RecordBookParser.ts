
import {BARSRecordBookSemester} from "../DataTypes";
import {parse} from 'node-html-parser'

import {CreateBARSError, BARSError} from "../Error/Error";

export default function(raw: string[]): BARSRecordBookSemester[] | BARSError{
  const result: BARSRecordBookSemester[] = []
    console.time('RecordBookParser')

  try{
      for(let i = 0; i < raw.length; i++) {
          let cellType: 'MARK_TEST' | 'NO_MARK_TEST' | 'EXAM' = 'NO_MARK_TEST'
          const $ = parse(raw[i]).querySelector('#div-Student__RecordBook > div.table-responsive > table > tbody')!
          try{
              $.querySelectorAll('tr')
          } catch (e: any){
              console.log('TODO make it better')
              break;
          }
          const sem: BARSRecordBookSemester = {
              semesterIndex: i + 1,
              name: (i + 1) + ' семестр',
              tests: [],
              exams: []
          }
          for(let k of $.querySelectorAll('tr')){

              const rawCell = k.querySelector('td:nth-child(1)')!.text.trim()
              if(rawCell.includes('экзамен')) continue
              if(rawCell.includes('зачёты')) continue

              const name = k.querySelector('td:nth-child(1)')!.text.trim()

              let weirdValue = k.querySelector('td:nth-child(2)')?.text
              typeof weirdValue == 'undefined' ? weirdValue = '-_' : weirdValue = weirdValue.trim()

              let rawCellType = k.querySelector('td:nth-child(3)')?.text
              if (rawCellType?.includes('Зачет с оценкой')){
                cellType = 'MARK_TEST'
              }
              else if (rawCellType?.includes('Зачёт')){
                cellType = 'NO_MARK_TEST'
              }
              else {
                cellType = 'EXAM'
              }

              let mark = k.querySelector('td:nth-child(4)')?.text
              typeof mark == 'undefined' ? mark = '-' : mark = mark.trim()

              let date = k.querySelector('td:nth-child(5)')?.text
              typeof date == 'undefined' ? date = '-' : date = date.trim()

              let teacherName = k.querySelector('td:nth-child(6)')?.text
              typeof teacherName == 'undefined' ? teacherName = '-' : teacherName = teacherName.trim()

              if(cellType == 'EXAM'){
                  sem.exams.push({
                          name,
                          weirdValue,
                          type: cellType,
                          mark,
                          date,
                          teacher: {name: teacherName, lec_oid: ''}})
              } else {
                  sem.tests.push({
                          name,
                          weirdValue,
                          type: cellType,
                          mark,
                          date,
                          teacher: {name: teacherName, lec_oid: ''} })
              }
          }
          sem.tests = sem.tests.concat(sem.exams)
          result.push(sem)
      }
      console.timeEnd('RecordBookParser')
        return result
  }catch (e: any){
    return CreateBARSError('RECORDS_PARSER_FAIL', e)
  }
}
