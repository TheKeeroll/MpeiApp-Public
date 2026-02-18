import { SkippedClass, SkippedClassManagedBy } from "../DataTypes";
import {CreateBARSError, BARSError} from "../Error/Error";
import {parse} from "node-html-parser";
import { Platform } from "react-native";

const LessonTypeFromHeader = (header: string) => {
  const types = [
    'лабораторная работа',
    'практическое занятие',
    'лекция',
    'консультация',
    'лекция (факультатив)',
    'консультации КП/КР'
  ]
  for(let type of types){
    if(header.toLowerCase().includes(type)) {
      switch(type) {
        case 'лабораторная работа':
          return 'Лаб. работа';
        case 'практическое занятие':
          return 'Практ. занятие';
        case 'лекция':
          return 'Лекция';
        case 'лекция (факультатив)':
          return 'Лекция';
        case 'консультация':
          return 'Консультация';
        case 'консультации КП/КР':
          return 'Консул. КП/КР';
      }
    }
  }
  return header.split(',')[2].split('(')[0].trim()
}

const RemoveExamType = (header: string) => {
  const examType = [
    '(экзамен)',
    '(лекция (факультатив))',
    '(зачёт с оценкой)',
    '(зачёт (без оценки))',
    '(зачёт с оценкой (по билетам))',
    '(защита КП/КР)'
  ]
  for(let type of examType){
    if(header.includes(type)) return header.replace(type, '')
  }
  return header
}

export const LessonIndexToTime = (index: string) => {
  const times = {
      '1':'9:20 - 10:55',
      '2':'11:10 - 12:45',
      '3':'13:45 - 15:20',
      '4':'15:35 - 17:10',
      '5':'17:20 - 18:50',
      '6':'18:55 - 20:25',
      '7':'20:30 - 22:00'
  }
  for(let i = 1; i < 8; i++){
    if(index.includes(i.toString())){
      //@ts-expect-error
      return times[i.toString()]
    }
  }
}

export default function(raw: string): SkippedClass[] | BARSError{

  const result: SkippedClass[] = []
  let $
  try{
    console.time('SkippedClassesParser - ' + Platform.OS)

    try {
      // $ = parse(raw).querySelector('#tbl__PartialListStudent__LessonSkip > tbody')!.querySelectorAll('tr')!
      $ = parse(raw).querySelector('#tbl__PartialListStudent__Lesson__Student > tbody')!.querySelectorAll('tr')!
    } catch (e){
      console.log('SkippedClasses not detected.')
      console.timeEnd('SkippedClassesParser - ' + Platform.OS)
      return result
    }

    for(let i of $){
      const isGoodExcuse = i.text.includes('уважительн')
      const rawHeader = RemoveExamType(i.querySelector('td:nth-child(1) > label > a')?.text?.trim() || i.querySelector('td:nth-child(1) > label')!.text.trim())
      //#tbl__PartialListStudent__LessonSkip > tbody > tr:nth-child(4) > td:nth-child(1) > span:nth-child(6)
      const rawCreatedBy = i.querySelector(`td:nth-child(1) > span:nth-child(${isGoodExcuse ? 6 : 5})`)!.text.split(' ')
      const rawLastChangeBy = i.querySelector(`td:nth-child(1) > span:nth-child(${isGoodExcuse ? 9 : 8})`)!.text.split(' ')
      const createdBy: SkippedClassManagedBy = {
        date: rawCreatedBy[1],
        time: rawCreatedBy[2],
        name: rawCreatedBy[3] + ' ' + rawCreatedBy[4]
      }
      const lastChangeBy: SkippedClassManagedBy = {
        date: rawLastChangeBy[1],
        time: rawLastChangeBy[2],
        name: rawLastChangeBy[3] + ' ' + rawLastChangeBy[4]
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

    console.timeEnd('SkippedClassesParser - ' + Platform.OS)
    return result
  }catch(e: any){
    console.warn('Unhandled error:' + e);
    return CreateBARSError('SKIPPED_CLASSES_PARSER_FAIL', e)
  }
}
