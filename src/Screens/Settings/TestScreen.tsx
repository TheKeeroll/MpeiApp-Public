import React from "react";
import moment from "moment";
import {BARSSchedule, BARSScheduleCell} from "../../API/DataTypes";

const GetDateRange = (from: Date, to: Date) => {
    const result: string[] = [];
    let curr = from;
    while (curr <= to){
        result.push(moment(curr).format('YYYY.MM.DD'));
        curr.addDays(1)
    }
    return result;
}

const TestScreen: React.FC = () => {

    const group = 'А-01-21'
    const linkSearch = 'http://ts.mpei.ru/api/search?term=' + encodeURI(group) +
        `&type=group`
    fetch(linkSearch,{
        method: 'GET',
        headers: {},
        credentials: 'include'
    }).then(r=>r.json()).then(r=>{
        const dateStart = moment('01.09.2022', 'DD.MM.YYYY');
        const dateEnd = moment('01.10.2022', 'DD.MM.YYYY');
        const linkSchedule = `http://ts.mpei.ru/api/schedule/group/${r[0].id}?start=${dateStart.format('YYYY.MM.DD')}&finish=${dateEnd.format('YYYY.MM.DD')}&lng=1`
        return fetch(linkSchedule, {
            method: 'GET',
            headers: {},
            credentials: 'include'
        }).then(r=>r.json()).then(r=>{
            const groupBy = (xs: any, key: any) => {
                return xs.reduce((rv: any, x: any) => {
                    (rv[x[key]] = rv[x[key]] || []).push(x);
                    return rv;
                }, {});
            };

            const range = GetDateRange(dateStart.toDate(), dateEnd.toDate())
            let grouped = groupBy(r, 'date')

            const result: BARSSchedule = {
                todayIndex: -1,
                days: []
            }
            for(let i = 0; i < range.length; i++){
                if(typeof grouped[range[i]] == 'undefined'){

                } else {
                    const isToday = moment(new Date()).format('YYYY.MM.DD') == range[i]
                    if(isToday) result.todayIndex = result.days.length ? result.days.length - 1 : 0
                    const day: BARSScheduleCell = {
                        date: moment(range[i], 'YYYY.MM.DD').format('DD.MM.YYYY'),
                        lessons:[],
                        isEmpty: false,
                        isToday: isToday
                    }


                    for(let lesson of grouped[range[i]]){
                        if(day.lessons.length){
                            const prev = day.lessons[day.lessons.length - 1]
                            if(prev.name == lesson.name && prev.lessonIndex == lesson.lessonIndex){ //combined lesson
                                day.lessons.push({
                                    name: lesson.discipline,
                                    lessonIndex: lesson.beginLesson + '-' + lesson.endLesson,
                                    lessonType: lesson.kindOfWork,
                                    place: prev.place + '|' + lesson.building,
                                    cabinet: prev.cabinet + '|' + lesson.auditorium,
                                    teacher: {
                                        name: prev.teacher.lec_oid + '|' + lesson.listOfLecturers[0].lecturer,
                                        lec_oid: prev.teacher.fullName + '|' + lesson.listOfLecturers[0].lecturerUID,
                                        fullName: prev.teacher.fullName + '|' + lesson.listOfLecturers[0].lecturer_title
                                    },
                                    group,
                                    type: 'COMBINED'
                                })
                            }
                        } else {
                            day.lessons.push({
                                name: lesson.discipline,
                                lessonIndex: lesson.beginLesson + '-' + lesson.endLesson,
                                lessonType: lesson.kindOfWork,
                                place: lesson.building,
                                cabinet: lesson.auditorium,
                                teacher: {
                                    name: lesson.listOfLecturers[0].lecturer,
                                    lec_oid: lesson.listOfLecturers[0].lecturerUID,
                                    fullName: lesson.listOfLecturers[0].lecturer_title
                                },
                                group ,
                                type: 'COMMON'
                            })
                            i++;
                        }
                        if(i==2){
                            day.lessons.push({
                                name: '',
                                lessonIndex: '',
                                lessonType: '',
                                place: '',
                                cabinet: '',
                                teacher: {name:'', lec_oid:''},
                                group: '' ,
                                type: 'DINNER'
                            })
                            i++
                        }
                    }
                    result.days.push(day)

                }
            }
            return Promise.resolve(result)
        })
    })
    return null
}

export default TestScreen
