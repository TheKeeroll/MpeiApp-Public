import { SkippedClass, SkippedClassManagedBy } from "../DataTypes";
import {CreateBARSError, BARSError} from "../Error/Error";
import {parse} from "node-html-parser";

const LessonTypeFromHeader = (header: string) => {
  const testFix = [
    'Лабораторная работа',
    'Практическое занятие',
    'Лекция',
    'Консультация',
    'Лекция (факультатив)',
    'Консультации КП/КР'
  ]
  for(let i of testFix){
    if(header.includes(i)) return i//header.replace(', ' + i + ',', '')
  }
  return 'NaN'

}

const RemoveExamType = (header: string) => {
  const testFix = [
    '(экзамен)',
    '(лекция (факультатив))',
    '(зачёт с оценкой)',
    '(зачёт (без оценки))',
    '(зачёт с оценкой (по билетам))',
    '(защита КП/КР)'
  ]
  for(let i of testFix){
    if(header.includes(i)) return header.replace(i, '')
  }
  return 'NaN'

}

export const LessonIndexToTime = (index: string) => {
  const times = {
      '1':'9:20 - 10:55',
      '2':'11:10 - 12:45',
      '3':'13:45 - 15:20',
      '4':'15:35 - 17:20',
      '5':'17:35 - 19:20',
      '6':'19:35 - 21:20',
      '7':'20:35 - 22:20'
  }
  for(let i = 1; i < 8; i++){
    if(index.includes(i.toString())){
      //@ts-ignore
      return times[i.toString()]
    }
  }
}

export default function(raw: string): SkippedClass[] | BARSError{

  try{
    console.time('SkippedClassesParser')

    const $ = parse(raw).querySelector('#tbl__PartialListStudent__LessonSkip > tbody')!.querySelectorAll('tr')!
    const result: SkippedClass[] = []

    for(let i of $){
      const isGoodExcuse = i.text.includes('По уважительной причине')
      const rawHeader = RemoveExamType(i.querySelector('td:nth-child(1) > label')!.text.trim())
      //#tbl__PartialListStudent__LessonSkip > tbody > tr:nth-child(4) > td:nth-child(1) > span:nth-child(6)
      const rawCreatedBy = i.querySelector(`td > span:nth-child(${isGoodExcuse ? 4 : 3})`)!.text.split(': ')[1].split(' ')
      const rawLastChangeBy = i.querySelector(`td > span:nth-child(${isGoodExcuse ? 6 : 5})`)!.text.split(': ')[1].split(' ')
      const createdBy: SkippedClassManagedBy = {
        date: rawCreatedBy[0],
        time: rawCreatedBy[1],
        name: rawCreatedBy[2] + rawCreatedBy[3]
      }
      const lastChangeBy: SkippedClassManagedBy = {
        date: rawLastChangeBy[0],
        time: rawLastChangeBy[1],
        name: rawLastChangeBy[2] + rawLastChangeBy[3]
      }
      const skippedClass: SkippedClass = {
        date: rawHeader.split(',')[0],
        lessonIndex: rawHeader.split(',')[1] ? rawHeader.split(',')[1].trim().split(' (')[0] : "-",
        lessonType: LessonTypeFromHeader(rawHeader),
        // lesson: rawHeader.split(LessonTypeFromHeader(rawHeader) + ', ')[1] ? rawHeader.split(LessonTypeFromHeader(rawHeader) + ', ')[1].trim() : "-",
        lesson: rawHeader.split(',')[3],
        createdBy,
        lastChangeBy,
        goodExcuse: isGoodExcuse
      }
      result.push(skippedClass)
    }

    console.timeEnd('SkippedClassesParser')
    return result
  }catch(e: any){
    console.warn('Unhandled error:' + e);
    return CreateBARSError('SKIPPED_CLASSES_PARSER_FAIL', e)
  }
}
