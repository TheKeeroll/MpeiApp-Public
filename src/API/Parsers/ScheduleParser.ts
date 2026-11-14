import type {BARSSchedule, BARSScheduleCell, BARSScheduleLesson, Teacher} from '../DataTypes';
import moment from 'moment';
import {getMoscowDate} from '../../Common/MoscowDate';

const text = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
const groupNames = (value: unknown): string => Array.isArray(value)
  ? value.map(row => typeof row === 'string' ? row : text(row?.group) || text(row?.name) || text(row?.label)).filter(Boolean).join('; ')
  : '';

const parseTeacher = (lesson: Record<string, any>): Teacher => {
  const lecturer = Array.isArray(lesson.listOfLecturers)
    ? lesson.listOfLecturers.find(row => row && (text(row.lecturer) || text(row.lecturer_title))) ?? lesson
    : lesson;
  const fullName = text(lecturer.lecturer_title);
  const name = text(lecturer.lecturer) || fullName || '-';
  if (/аканси/i.test(name)) return {name: '-', lec_oid: ''};
  return {name, fullName: fullName || undefined,
    // lecturerOid is NOT a person discovery ID. Navigation searches by fullName.
    lec_oid: text(lecturer.lecturerUID)};
};

/** Strict top-level shape; optional/null lesson metadata must not discard valid classes. */
export const ParseTsMPEISchedule = (value: unknown, today = getMoscowDate()): BARSSchedule => {
  if (!Array.isArray(value)) throw new Error('Invalid schedule response');
  const grouped = new Map<string, BARSScheduleLesson[]>();
  for (const row of value) {
    if (!row || typeof row !== 'object') throw new Error('Invalid schedule lesson');
    const date = moment(text(row.date), ['YYYY.MM.DD', 'YYYY-MM-DD'], true);
    const start = moment(text(row.beginLesson), ['HH:mm', 'H:mm'], true);
    const finish = moment(text(row.endLesson), ['HH:mm', 'H:mm'], true);
    if (!date.isValid() || !start.isValid() || !finish.isValid() || !text(row.discipline)) {
      throw new Error('Invalid schedule lesson date, time or discipline');
    }
    const kind = text(row.kindOfWork);
    const group = /екция/i.test(kind) ? text(row.stream) : text(row.subGroup) || text(row.group);
    const lesson: BARSScheduleLesson = {
      name: text(row.discipline), lessonIndex: `${start.format('HH:mm')}-${finish.format('HH:mm')}`,
      lessonType: kind, place: text(row.building), cabinet: text(row.auditorium), teacher: parseTeacher(row),
      group: group || text(row.group) || text(row.subGroup) || text(row.stream) || groupNames(row.listGroups) || groupNames(row.listSubGroups),
      type: 'COMMON',
    };
    const key = date.format('YYYY-MM-DD');
    const lessons = grouped.get(key) ?? [];
    // Exact duplicate records do not create duplicated lessons/teachers.
    if (!lessons.some(existing => JSON.stringify(existing) === JSON.stringify(lesson))) lessons.push(lesson);
    grouped.set(key, lessons);
  }
  const days: BARSScheduleCell[] = [];
  const dates = [...grouped.keys()].sort();
  if (dates.length) {
    const date = moment(dates[0], 'YYYY-MM-DD');
    const last = moment(dates[dates.length - 1], 'YYYY-MM-DD');
    if (last.diff(date, 'days') > 740) throw new Error('Unexpected schedule date range');
    for (; date.isSameOrBefore(last, 'day'); date.add(1, 'day')) {
      const lessons = (grouped.get(date.format('YYYY-MM-DD')) ?? []).sort((a, b) => a.lessonIndex.localeCompare(b.lessonIndex));
      const combined: BARSScheduleLesson[] = [];
      for (let i = 0; i < lessons.length; i++) {
        const a = lessons[i]!;
        const b = lessons[i + 1];
        if (b && a.name === b.name && a.lessonIndex === b.lessonIndex && a.lessonType === b.lessonType) {
          combined.push({...a, type: 'COMBINED', place: `${a.place}|${b.place}`, cabinet: `${a.cabinet}|${b.cabinet}`,
            group: `${a.group}|${b.group}`, teacher: {name: `${a.teacher.name}|${b.teacher.name}`,
              fullName: `${a.teacher.fullName || a.teacher.name}|${b.teacher.fullName || b.teacher.name}`,
              lec_oid: `${a.teacher.lec_oid}|${b.teacher.lec_oid}`}});
          i++;
        } else combined.push(a);
      }
      const formatted = date.format('DD.MM.YYYY');
      days.push({date: formatted, lessons: combined, isEmpty: combined.length === 0, isToday: formatted === today});
    }
  }
  return {days, todayIndex: days.findIndex(day => day.isToday)};
};

/** Read the legacy name without clearing the student's saved timetable/account. */
export const normalizeSavedSchedule = (value: unknown): BARSSchedule => {
  if (!value || typeof value !== 'object' || !Array.isArray((value as BARSSchedule).days)) throw new Error('Invalid saved schedule');
  const {fullTeacherName, ...schedule} = value as BARSSchedule & {fullTeacherName?: string};
  return {...schedule, scheduleName: text(schedule.scheduleName) || text(fullTeacherName) || undefined};
};

export const DealWithMeal = (schedule: BARSSchedule): BARSSchedule => {
  for (const day of schedule.days) {
    if (day.lessons.some(lesson => lesson.type === 'DINNER')) continue;
    let lunchAfter = -1;
    day.lessons.forEach((lesson, index) => { if (lesson.lessonIndex === '11:10-12:45') lunchAfter = index; });
    if (lunchAfter >= 0 && lunchAfter < day.lessons.length - 1) {
      day.lessons.splice(lunchAfter + 1, 0, {type: 'DINNER', name: 'Обед', lessonIndex: '12:45-13:45',
        lessonType: '', place: '', cabinet: '', group: '', teacher: {name: '-', lec_oid: ''}});
    }
  }
  return schedule;
};

export const CalculateRange = (now = new Date()): Date[] => {
  const start = moment(now);
  const end = moment(now);
  const month = start.month();
  if (month === 0) { start.subtract(30, 'days'); end.add(30, 'days'); }
  else if (month === 1) { start.subtract(28, 'days'); end.add(100, 'days'); }
  else if (month >= 2 && month <= 6) {
    start.subtract(Math.floor((month + 1) * 2.6 * 7), 'days');
    end.add(Math.floor((8 - (month + 1)) * 2.6 * 7), 'days');
  } else {
    start.subtract(Math.floor((month - 6) * 2.6 * 7), 'days');
    end.add(Math.floor((8 - (month - 6)) * 2.6 * 7), 'days');
  }
  return [start.toDate(), end.toDate()];
};
