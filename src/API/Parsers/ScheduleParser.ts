import { BARSSchedule, BARSScheduleCell, BARSScheduleLesson } from "../DataTypes";
import moment from "moment";


// утилита для безопасного исправления годов
const fixScheduleYears = (days: BARSScheduleCell[]) => {
  let counter = 0;
  let YearForFix = String(new Date().getFullYear());
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const initial = d.date ?? "";
    const parts = initial.split(".");
    if (parts.length === 3) {
      let [dd, mm, yyyy] = parts;
      const yearNum = parseInt(yyyy, 10);
      const fixNum = parseInt(YearForFix, 10);
      // динамическое обновление YearForFix
      if (yearNum > fixNum) {
        YearForFix = yyyy;
        console.log(`fixScheduleYears - YearForFix increased to ${YearForFix}`);
      } else if (yearNum !== 2020 && yearNum < fixNum) {
        YearForFix = yyyy;
        console.log(`fixScheduleYears - YearForFix decreased to ${YearForFix}`);
      }
      // исправление "2020" → YearForFix
      if (yyyy.includes("2020") && YearForFix !== "2020") {
        const newDate = `${dd}.${mm}.${YearForFix}`;
        if (newDate !== d.date) {
          d.date = newDate;
          counter++;
          // console.log(`fixScheduleYears - day[${i}] fixed: ${initial} → ${newDate}`);
        }
      }
    }
  }
  console.log(`fixScheduleYears - year fixed in ${counter} days`);
  return days;
};

const groupBy = function(xs: any, key: any) {
  return xs.reduce(function(rv: any, x: any) {
    (rv[x[key]] = rv[x[key]] || []).push(x);
    return rv;
  }, {});
};

export const ParseTsMPEISchedule = (r: any)=> {
  let result: BARSSchedule = {
    days: [],
    todayIndex: -1
  }
  try {
    let grouped = groupBy(r, 'date');
    for (const [key, value] of Object.entries(grouped)) {
      const date_ = moment(key, 'YYYY.MM.DD').format('DD.MM.YYYY')
      const day: BARSScheduleCell = {
        date: date_,
        lessons: [],
        isEmpty: false,
        isToday: date_ == moment(new Date()).format('DD.MM.YYYY')
      }
      // console.log(date_, moment(new Date()).format('DD.MM.YYYY'))
      for (let lesson of (value as any)) {

        const c: BARSScheduleLesson = {
          name: lesson.discipline,
          lessonIndex: lesson.beginLesson + '-' + lesson.endLesson,
          lessonType: lesson.kindOfWork,
          place: lesson.building,
          cabinet: lesson?.auditorium || '',
          teacher: {
            name: lesson.listOfLecturers[0].lecturer.includes('аканси') ? '-' : lesson.listOfLecturers[0].lecturer,
            lec_oid: lesson.listOfLecturers[0].lecturerUID,
            fullName: lesson.listOfLecturers[0].lecturer_title
          },
          group: lesson.kindOfWork.includes('екция') ? lesson.stream : (lesson.subGroup || lesson.group),
          type: 'COMMON'
        }
        day.lessons.push(c)
      }
      result.days.push(day)
    }

    for (let i = 1; i < result.days.length; i++) {
      const prev = moment(result.days[i - 1].date, 'DD.MM.YY').toDate()
      const curr = moment(result.days[i].date, 'DD.MM.YY').toDate()
      const missedDaysCount = (curr.getTime() - prev.getTime()) / 8640000 / 10 - 1
      for (let j = 0; j < missedDaysCount; j++) {
        const missedDate = new Date(moment(result.days[i + j - 1].date, 'DD.MM.YY').toDate())
        missedDate.addDays(1)
        const missedDay: BARSScheduleCell = {
          date: missedDate.getDDMMYY(),
          lessons: [],
          isEmpty: true,
          isToday: missedDate.getDDMMYY().replace(/\.\d{4}/g, '') == moment(new Date(), 'DD.MM.YY').toDate().getDDMMYY().replace(/\.\d{4}/g, '') //TODO do better
        }
        //result.todayIndex = i+j
        // console.log(missedDate.getDDMMYY().replace(/\.\d{4}/g, '') +' : '+ moment(new Date(), 'DD.MM.YY').toDate().getDDMMYY().replace(/\.\d{4}/g, ''))
        result.days.splice(i + j, 0, missedDay)
      }
    }

    for (let i = 0; i < result.days.length; i++) {
      for (let j = 0; j < result.days[i].lessons.length - 1; j++) {
        const a = result.days[i].lessons[j]
        const b = result.days[i].lessons[j + 1]
        if (a.name == b.name && a.lessonIndex == b.lessonIndex) {
          // console.log(a.teacher.fullName + '|' + b.teacher.fullName);

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
          result.days[i].lessons.splice(j, 2, c)
        }
      }
    }
    result.days = fixScheduleYears(result.days);
    // фильтруем 29.02 для невисокосных годов
    const currentYear = new Date().getFullYear();
    const has29Feb = result.days.some(d => d.date.includes("29.02"));
    if (has29Feb && currentYear % 4 !== 0) {
      result.days = result.days.filter(d => !d.date.includes("29.02"));
      console.log("Unlisted date filtered out!");
    }
  } catch (e:any) {
    console.warn('ParseTsMPEISchedule - ' + e.toString());
  }
  return result
}

export const DealWithMeal = (schedule: BARSSchedule) : BARSSchedule => {
  for(let i = 0; i < schedule.days.length; i++){
    for(let j = 0; j < schedule.days[i].lessons.length; j++){
      if(schedule.days[i].lessons[j].lessonIndex == '11:10-12:45'){
        try {
          if (schedule.days[i].lessons[j + 1].lessonIndex == '11:10-12:45') {
            //@ts-expect-error
            schedule.days[i].lessons.splice(j + 2, 0, { type: 'DINNER' })
          } else {
            //@ts-expect-error
            schedule.days[i].lessons.splice(j + 1, 0, { type: 'DINNER' })
          }
        } catch (e) {
          //@ts-expect-error
          schedule.days[i].lessons.splice(j + 1, 0, { type: 'DINNER' })
        }
        j++
        break
      }

    }

  }
  for(let i = 0; i < schedule.days.length; i++) {
    if(schedule.days[i].isEmpty) {
      continue;
    }
    if(schedule.days[i].lessons[schedule.days[i].lessons.length -1].type == 'DINNER'){
      schedule.days[i].lessons.pop()
    }
  }
  return schedule
}

/*export const DealWithRepeated = (schedule: BARSSchedule) : BARSSchedule => {
  for(let i = 0; i < schedule.days.length; i++) {
    for (let j = 0; j < schedule.days[i].lessons.length; j++) {
      try {
        if (schedule.days[i].lessons[j].name == schedule.days[i].lessons[j - 1].name && schedule.days[i].lessons[j].lessonType == schedule.days[i].lessons[j - 1].lessonType && schedule.days[i].lessons[j].cabinet == schedule.days[i].lessons[j - 1].cabinet && schedule.days[i].lessons[j].lessonIndex == schedule.days[i].lessons[j - 1].lessonIndex) {
          schedule.days[i].lessons.splice(j, 1)
          j--
        }
      } catch (e) {
      }
    }
  }
  return schedule
}*/

export const CalculateRange = () : Date[] => {
  let start = new Date()
  let end = new Date()
  const currentMonthNum = start.getMonth()
  if (currentMonthNum == 0) {
    start.substractDays(30)
    end.addDays(30)
  } else if(currentMonthNum == 1){
    start.substractDays(28)
    end.addDays(100)
  } else if((currentMonthNum >= 2) && (currentMonthNum <= 6)){
    start.substractDays(Math.floor((currentMonthNum + 1) * 2.6 * 7))
    end.addDays(Math.floor((8 - (currentMonthNum + 1)) * 2.6 * 7))
  } else {
    start.substractDays(Math.floor((currentMonthNum - 6) * 2.6 * 7))
    end.addDays(Math.floor((8 - (currentMonthNum - 6)) * 2.6 * 7))
  }
  return [start, end]
}
