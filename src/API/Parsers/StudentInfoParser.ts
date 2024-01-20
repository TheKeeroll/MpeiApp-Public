import { BARSStudentInfo } from "../DataTypes";
import {Platform} from "react-native";
// @ts-ignore
import * as HTMLParser from 'fast-html-parser'
import {BARSError, CreateBARSError} from "../Error/Error";
export function ParseStudentInfo(raw: string): BARSStudentInfo | BARSError{
  console.time('FHT ' + Platform.OS)

  const root = HTMLParser.parse(raw)
  const firstPart = root.querySelector('#div-FormHeader')!
      .querySelector('div')!
      .querySelector('div')!
      .querySelector('div')!
  let _FIO : string
  try {
     _FIO = firstPart.childNodes[1].querySelector('span')!.text.trim()
  }catch (e) {
    console.warn("on _FIO: " + e);
    _FIO = 'ФИО (не распарсилось!)'
  }
  let _course: string
  try {
    _course = firstPart.childNodes[1].querySelector('ul')!.childNodes[3]!.querySelector('strong')!.text
  }catch (e)  {
    console.warn("on _course: " + e);
    _course = 'Курс (не распарсилось!)'
  }
  let _qualification:string
  try {
    _qualification = firstPart.childNodes[1].querySelector('ul')!.childNodes[5]!.querySelector('strong')!.text
  }catch (e) {
    console.warn("on _qualification: " + e);
    _qualification = 'Квалификация (не распарсилось!)'
  }
  let _direction: string
  try {
    _direction = firstPart.childNodes[1].querySelector('ul')!.childNodes[7]!.querySelector('strong')!.text.trim()
  }catch (e) {
    console.warn("on _direction: " + e);
    _direction = 'Направление (не распарсилось!)'
  }
  let _mail: string
  try {
    _mail = firstPart.childNodes[1].querySelector('ul')!.childNodes[1]!.querySelector('strong')!.text.trim()
  }catch (e) {
    console.warn("on _mail: " + e);
    _mail = 'parsetrouble@mail.ru'
  }
  let _status: string
  try {
    _status = firstPart.childNodes[1].querySelector('ul')!.childNodes[11]!.querySelector('strong')!.text
  }catch (e) {
    console.warn("on _status: " + e);
    _status = 'Статус (не распарсилось!)'
  }
  let _educationForm: string
  try {
    _educationForm = firstPart.childNodes[1].querySelector('ul')!.childNodes[9]!.querySelector('strong')!.text
  }catch (e) {
    console.warn("on _educationForm: " + e);
    _educationForm = 'Форма обучения (не распарсилось!)'
  }
  const _id = root.querySelector('#miSection1')!.querySelector('a.list-group-item.activeUrl')!.attributes['href'].replace('/bars_web/ST_Study/Main/Main?studentID=', '').trim()
  let _study_rating: string
  try {
    _study_rating = firstPart.childNodes[3]!.querySelector('#RST')!.text.trim()
  }catch (e) {
    console.warn("on _study_rating: " + e);
    _study_rating = '(не распарсилось!)'
  }
  let _complex_rating: string
  try {
    _complex_rating = firstPart.childNodes[3]!.querySelector('ul')!.childNodes[17]!.querySelector('strong')!.text.trim()
  }catch (e) {
    console.warn("on _complex_rating: " + e);
    _complex_rating = '(не распарсилось!)'
  }




  console.timeEnd('FHT ' + Platform.OS)

  try {

    const studentInfo: BARSStudentInfo = {
      name: _FIO.split(' ')[1],
      surname: _FIO.split(' ')[0],
      middleName: _FIO.split(' ')[2],
      mail: _mail,
      indexBook: _FIO.split(' - ')[1].split(') ')[0],
      group: _FIO.split(' ')[6],
      course: _course,
      qualification: _qualification,
      direction: _direction,
      educationForm: _educationForm,
      status: _status,
      study_rating: _study_rating,
      complex_rating: _complex_rating,
      id: _id,
      headman: false // will set later
    }

    console.log('Successfully parsed student info');
    return studentInfo
  } catch(e: any) {
    console.warn('Failed to parse student info! Reason:', e);
    return CreateBARSError('STUDENT_INFO_PARSER_FAIL', 'Не удалось обработать ответ от сервера!')
  }

}
