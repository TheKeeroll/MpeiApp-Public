import { BARSSchedule, BARSScheduleCell, BARSScheduleLesson, Teacher } from "../DataTypes";
import {TEACHER_RANKS } from "../../Common/Constants";
import {BARSError, CreateBARSError, isBARSError} from "../Error/Error";
import moment from "moment";

import {parse} from 'node-html-parser'
const DisciplineFromHeader = (header: string) => {
    const testFix = [
        '(Лабораторная работа)',
        '(Практическое занятие)',
        '(Лекция)',
        '(Консультация)',
        '(Экзамен)',
        '(Лекция (факультатив))',
        '(Зачет с оценкой)',
        '(Зачет (по билетам))',
        '(Зачет с оценкой (по билетам))',
        "(Защита курсового проекта)",
        "(Зачет с оценкой (по совокупности результатов текущего контроля))",
        "(Практическое занятие (факультатив))", "(Зачет)", "(Защита курсовой работы)",
        "(Зачет (по совокупности результатов текущего контроля))",
        "(Защита курсовой работы)",
        "(Экзамен (просмотр))"
    ]
    for(let i of testFix){
      if(header.includes(i)) return header.replace(i, '')
    }
    return header

}

const fixTeacherName = (nameRaw: string)=>{

    for(let i of TEACHER_RANKS){
        if(nameRaw.includes(i)){
            return nameRaw.replace(i + ' ', '')
        }
    }
    return nameRaw
}

export default function(raw: string, teacherMode: boolean = false): BARSSchedule | BARSError{
    console.time('ScheduleParser')

    try {
        const $ = parse(raw)
        if(teacherMode){
            const error = $.querySelector('#div-Timetable  > span')?.text
            if(typeof error != 'undefined' && error != ''){
                return CreateBARSError('MARK_TABLE_PARSER_FAIL','БАРС не смог предоставить расписание.')
            }
        }

        const $trs = $.querySelector('#div-Timetable > div.table-responsive > table > tbody')?.querySelectorAll('tr')!

        const result: BARSScheduleCell[] = []
        let tmpCell: Partial<BARSScheduleCell> = {}

        for(let i of $trs){
            if(i.classNames == 'table-primary'){
                if(typeof tmpCell.date != 'undefined'){
                    result.push(tmpCell as BARSScheduleCell)
                }
                tmpCell = {}
                const date = new Date().dateFromBarsFormat(i.text/*.trim()*/)
                tmpCell.date = date.getDDMMYY()
                tmpCell.lessons = []
                tmpCell.isEmpty = false
                tmpCell.isToday = false
            } else {
                if(i.querySelector(`td:nth-child(2) > strong`) == null) continue
                let header = i.querySelector(`td:nth-child(2) > strong`)!.text/*.trim()*/
                const name = DisciplineFromHeader(header)
                const aCount = i.querySelectorAll('a').length
                let teacher: Teacher
                let rawGroup = '-'

                if(name == 'NaN'){
                    console.warn('No discipline found in: ' + header);
                    return CreateBARSError('MARK_TABLE_PARSER_FAIL','No discipline found in ' + header)
                }

                switch(aCount){
                    case 1:{
                        console.log(i.querySelector(`td:nth-child(2) > a`)?.text)
                        try{
                            const fixed = fixTeacherName(i.querySelector(`td:nth-child(2) > a`)!.text/*.trim()*/)
                            const lec_oid = i.querySelector(`td:nth-child(2) > a`)!.attributes['href'].replace('/bars_web/Timetable/RUZ/Timetable?rt=1&lec_oid=', '')
                            teacher = {
                                name: fixed,
                                lec_oid
                            }
                            const rawRawGroup = i.querySelector(`td:nth-child(2)`)!.text
                            rawGroup = rawRawGroup.includes(',') ? '-' : rawRawGroup.split(name)[1].split('п.')[0].split('\\')[1]/*.trim()*/
                        } catch(e: any){
                            console.warn('FIX ME ScheduleParser: ', e)
                            teacher = {
                                name: '-',
                                lec_oid: '-'
                            }
                        }
                        break
                    }
                    case 2:{

                        try{
                            teacher = {
                                name: teacherMode ? '-' : fixTeacherName(i.querySelector(`td:nth-child(2) > a:nth-child(5)`)!.text),
                                lec_oid: teacherMode ? '-' :  i.querySelector(`td:nth-child(2) > a:nth-child(5)`)!.attributes['href'].replace('/bars_web/Timetable/RUZ/Timetable?rt=1&lec_oid=', '')
                            }
                        } catch (e: any){
                            console.warn('FIX ME Schedule parser')
                            teacher = {
                                name: '-',
                                lec_oid: '-'
                            }
                        }
                        break
                    }
                    default: teacher = {name:'-', lec_oid:'-'}
                }

                const time = i.querySelector(`td.col-auto > strong`)!.text

                const placeAndCabinet = i.querySelector(`td.col-auto`)!.text.replace(time, '')/*.trim()*/

                const lesson: BARSScheduleLesson = {
                    name,
                    lessonIndex: i.querySelector(`td.col-auto > strong`)!.text/*.trim()*/,
                    lessonType: header.replace(name, '').replace('(','').replace(')', '')/*.trim()*/,
                    place: placeAndCabinet.split(' (')[1].replace(')', ''),
                    teacher,
                    cabinet: placeAndCabinet.split(' (')[0],
                    group: rawGroup,
                    type: 'COMMON'
                }
                tmpCell.lessons!.push(lesson)
            }


        }
        if(!teacherMode) {
            //Комбинируем групповые пары
            for (let i = 0; i < result.length; i++) {
                for (let j = 0; j < result[i].lessons.length - 1; j++) {
                    const a = result[i].lessons[j]
                    const b = result[i].lessons[j + 1]
                    if (a.name == b.name && a.lessonIndex == b.lessonIndex) {
                        const c: BARSScheduleLesson = {
                            name: a.name,
                            lessonIndex: a.lessonIndex,
                            lessonType: a.lessonType,
                            place: a.place + '|' + b.place,
                            cabinet: a.cabinet + '|' + b.cabinet,
                            teacher: {
                                name: a.teacher.name + '|' + b.teacher.name,
                                lec_oid: a.teacher.lec_oid + '|' + b.teacher.lec_oid,
                                fullName: a.teacher.fullName + '|' + b.teacher.fullName
                            },
                            group: a.group + '|' + b.group,
                            type: 'COMBINED'
                        }
                        result[i].lessons.splice(j, 2, c)
                    }
                }
            }
        }
        //Заполняем пропущенные дни
        for(let i = 1; i < result.length; i++){
            const prev = moment(result[i-1].date, 'DD.MM.YY').toDate()
            const curr = moment(result[i].date, 'DD.MM.YY').toDate()
            const missedDaysCount = (curr.getTime() - prev.getTime()) / 8640000  / 10 - 1
            for(let j = 0; j < missedDaysCount; j++){
                const missedDate = new Date(moment(result[i + j - 1].date, 'DD.MM.YY').toDate())
                missedDate.addDays(1)
                const missedDay: BARSScheduleCell = {
                    date: missedDate.getDDMMYY(),
                    lessons: [],
                    isEmpty: true,
                    isToday: false
                }
                result.splice(i+j,0,missedDay)
            }
        }
        if(!teacherMode) {
            //Не забываем пообедать и сократить эо и дот
            for(let i = 0; i < result.length; i++){
                for(let j = 0; j < result[i].lessons.length; j++){
                    if(result[i].lessons[j].lessonIndex == '11:10-12:45'){
                        //@ts-ignore
                        result[i].lessons.splice(j+1, 0, {type: 'DINNER'})
                        j++;
                        break;
                    }

                }

            }
            for(let i = 0; i < result.length; i++) {
                if(result[i].isEmpty) {
                    continue;
                }
                if(result[i].lessons[result[i].lessons.length -1].type == 'DINNER'){
                    result[i].lessons.pop()
                }
            }
        }

        const today = new Date().getDDMMYY()
        let index = -1
        for(let i = 0; i < result.length; i++){
            if(result[i].date == today){
                result[i].isToday = true
                index = i
                break;
            }
        }
        console.timeEnd('ScheduleParser')

        return {
                todayIndex: index,
                days: result,
                fullTeacherName: '-'//teacherMode ? $.querySelector('#div-Timetable > h3')!.text/*.trim()*/ : ''
        } as BARSSchedule
    }    catch (e: any){
        if(isBARSError(e)){
            return e
        }
        if(e == ''){
            e = 'unknown'
        }
        return CreateBARSError("SCHEDULE_PARSER_FAIL", e)
    }
}
