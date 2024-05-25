import {Dimensions} from "react-native";

export const URLS = {
  BARS_MAIN: 'https://bars.mpei.ru/bars_web/',
  BARS_MULTI_ACCOUNT: 'https://bars.mpei.ru/bars_web/Student/ListStudent',
  BARS_TASKS:  'https://bars.mpei.ru/bars_web/ST_Study/StudentTask/ListStudent__StudentTask?studentID=',
  BARS_REPORTS:  'https://bars.mpei.ru/bars_web/ST_Study/StudentReport/ListStudent__StudentReport?studentID=',
  BARS_QUESTIONNAIRES: 'https://bars.mpei.ru/bars_web/ST_Q/QuestionnaireAnswer/ListStudent__QuestionnaireAnswer?studentID=',
  BARS_RECORD_BOOK:  'https://bars.mpei.ru/bars_web/ST_LK/RecordBook/ListStudent__RecordBook?studentID=',
  BARS_STIPENDS: 'https://bars.mpei.ru/bars_web/ST_LK/ScholarshipEvent/ListStudent__ScholarshipEvent?studentID=',
  BARS_ORDERS: 'https://bars.mpei.ru/bars_web/ST_LK/Order/ListStudent__Order?studentID=',
  BARS_SCHEDULE: 'https://bars.mpei.ru/bars_web/Timetable/RUZ/Timetable?rt=3&name=',
  BARS_TEACHER_SCHEDULE: 'https://bars.mpei.ru/bars_web/Timetable/RUZ/Timetable?rt=1&lec_oid=',
  BARS_SEMESTER: 'https://bars.mpei.ru/bars_web/ST_Study/Student_SemesterSheet/_PartialListStudent_SemesterSheet__Mark?studentID=',
  BARS_SKIPPED_CLASSES: 'https://bars.mpei.ru/bars_web/ST_Study/LessonSkip/ListStudent__LessonSkip?studentID=',

  HM_LIST_GROUP: 'https://bars.mpei.ru/bars_web/StudyGroup/StudyGroup/ListStudyGroup',
  HM_STUDENT_LIST: 'https://bars.mpei.ru/bars_web/StudyGroup/Student/ListStudyGroup__Students?sgID=',
  HM_LESSON_SKIP: 'https://bars.mpei.ru/bars_web/ST_Study/LessonSkip/_PartialListStudent__LessonSkip?studentID=',
  HM_REPORTS: 'https://bars.mpei.ru/bars_web/Report/ListReport'
}

export const COMMON_HTTP_HEADER = {
  'accept': '*/*',
  'accept-encoding': 'gzip, deflate, br',
  'accept-language': 'ru,en;q=0.9',
  'content-length': '0',
  'dnt': '1',
  'origin': 'https://bars.mpei.ru',
  'referer': 'https://bars.mpei.ru/',
  'sec-ch-ua': `"Chromium";v="112", "YaBrowser";v="23", "Not:A-Brand";v="99"`,
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': `"Windows"`,
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'no-cors',
  'sec-fetch-site': 'cross-site',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 YaBrowser/23.5.4.674 Yowser/2.5 Safari/537.36',
  'y-browser-experiments': 'NjczMTM3LDAsNTA=',
  'credentials': 'include'
}
export const STORAGE_KEYS = {
  CREDENTIALS: 'credentials',
  THEME: 'theme',
  SCHEDULE: 'schedule',
  MARKS: 'marks',
  STUDENT_INFO: 'studentInfo',
  TASKS: 'tasks',
  REPORTS: 'reports',
  QUESTIONNAIRES: 'questionnaires',
  STIPENDS: 'stipends',
  ORDERS: 'orders',
  SKIPPED_CLASSES: 'skippedClasses',
  RECORD_BOOK: 'recordBook',
  MAIL_CACHE: 'mailCache',
  MAIL_USERS_CACHE: 'mailUsers',
  ADDITIONAL_DATA: 'additionalData'
}

export const TEACHER_RANKS: string[] = [
  'доц.',
  'ассист.',
  'ст.преп.',
  'проф.',
  'зав. каф.'
]
export const SCREEN_SIZE = Dimensions.get('window')
