export interface BARSData{
  student: BARSStudentInfo
  marks: BARSMarks
  reports: BARSReport[]
  records: BARSRecordBookSemester[]
  schedule: BARSSchedule
  availableSemesters: Semester[]
  skippedClasses: SkippedClass[]
}

export interface MarkDiff{
  discipline: string,
  kmName: string,
  mark: string
}

export interface Semester{
  name: string
  id: string
}

export interface BARSStudentInfo{
  name: string
  surname: string
  middleName: string
  mail: string
  indexBook: string
  group: string
  course: string
  qualification: string
  direction: string
  educationForm: string
  status: string
  study_rating: string
  complex_rating: string

  id: string
  headman: boolean
}

export type MarkType = 'CURRENT' | 'RETAKE' |'RETAKE_EXAM_1' | 'RETAKE_EXAM_2' | 'RED_SESSION' | 'NOT_TAKEN_INTO_ACCOUNT'

export interface Mark{
  date: string
  mark: string
  type: MarkType
}

export interface KM {
  name: string
  week: string
  weight: string
  marks: Mark[]
}

export interface BARSDiscipline {
  name: string
  examType: string
  passUpUntil: string
  teacher: Teacher
  kms: KM[]
  examMarks: Mark[]
  resultMarks: Mark[]
  sredBall: string
  debt?: boolean
  examAutoId?: string
}

export interface BARSRecordBookDiscipline{
  name: string
  weirdValue: string
  type: 'MARK_TEST' | 'NO_MARK_TEST' | 'EXAM'
  mark: string
  date: string
  teacher: Teacher
}

export interface BARSRecordBookSemester{
  semesterIndex: number
  name: string
  tests: BARSRecordBookDiscipline[]
  exams: BARSRecordBookDiscipline[]
}


export interface Teacher{
  name: string
  lec_oid: string,
  fullName?: string
}

export interface BARSMarks{
  disciplines: BARSDiscipline[]
  semesterName: string
  semesterID: string
}

export interface BARSReport{
  semester: string
  type: string
  binding: string
  status: string
}

export interface BARSQuestionnaire {
  name: string
  description: string
  status: string
  fill_until: string
  completed: string
}

export interface BARSTask {
  // type: string
  manager: string
  // name: string
  date: string
  semester: string
  discipline: string
  place: string
  status: string
  status_date: string
  status_author: string
}

export interface BARSStipend {
  start_date: string
  end_date: string
  type: string
  amount: string
  order_date: string
  order_number: string
}

export interface BARSOrder {
  num: string,
  date: string,
  content: string,
}


export interface BARSScheduleLesson{
  name: string
  lessonIndex: string
  lessonType: string
  place: string
  cabinet: string
  teacher: Teacher
  group: string
  type: 'COMBINED' | 'DINNER' | 'COMMON'
}

export interface BARSSchedule{
  todayIndex: number
  days: BARSScheduleCell[]
  fullTeacherName?: string
}

export interface BARSScheduleCell{
  date: string
  lessons: BARSScheduleLesson[]
  isEmpty: boolean
  isToday: boolean
}
export interface SkippedClassManagedBy{
  name: string
  date: string
  time: string
}

export interface SkippedClass{
  date: string
  lesson: string
  lessonIndex: string
  lessonType: string
  goodExcuse: boolean
  createdBy: SkippedClassManagedBy
  lastChangeBy: SkippedClassManagedBy
}
export interface BARSCredentials {
  login: string
  password: string
}

export interface AdditionalData {
  finalMarkAvailabilityCounter: number
}

export interface ScheduleForWidget {
  yesterday: BARSScheduleCell
  today: BARSScheduleCell
  tomorrow: BARSScheduleCell
}

