import {
  AdditionalData,
  BARSCredentials,
  BARSData,
  BARSDiscipline,
  BARSMarks,
  BARSSchedule,
  BARSScheduleCell,
  BARSScheduleLesson,
  BARSStudentInfo, OWAMail,
  Semester,
  Teacher,
} from "./DataTypes";
import {
  COMMON_HTTP_HEADER, HEADER_WITH_USER_ID,
  LOGIN_HEADER,
  STORAGE_KEYS,
  URLS,
} from "../Common/Constants";
import { cheerio, Compare } from "../Common/Globals";
import { ParseStudentInfo } from "./Parsers/StudentInfoParser";
import ParsMarkTable from "./Parsers/MarkTableParser";
import SkippedClassesParser from "./Parsers/SkippedClassesParser";
import ReportsParser from "./Parsers/ReportsParser";
import { Alert, DeviceEventEmitter, LayoutAnimation, Platform } from "react-native";
import { APP_CONFIG } from "../Common/Config";
import RecordBookParser from "./Parsers/RecordBookParser";
import { TEST_DATA } from "./TestCurrentData";
import { parse } from "node-html-parser";
import { createMMKV } from "react-native-mmkv";
import { Store } from "./Redux/Store";
import {
  updateAdditionalData,
  updateBooks,
  updateMail,
  updateMarkTable,
  updateOrders,
  updateQuestionnaires,
  updateRecordBook,
  updateReports,
  updateSchedule,
  updateSkippedClasses,
  updateStipends,
  updateTasks,
} from "./Redux/Slices";
import { THEME_DARK, THEME_LIGHT } from "../Themes/Themes";
import { CreateBARSError, isBARSError } from "./Error/Error";
import { changeIcon, getIcon } from "react-native-change-icon";
import NetInfo from "@react-native-community/netinfo";
import moment from "moment/moment";
import QuestionnairesParser from "./Parsers/QuestionnairesParser";
import TasksParser from "./Parsers/TasksParser";
import StipendsParser from "./Parsers/StipendsParser";
import OrdersParser from "./Parsers/OrdersParser";
// @ts-expect-error
import * as HTMLParser from 'fast-html-parser'
import BooksParser from "./Parsers/BooksParser";
import MailParser from "./Parsers/MailParser";
import { CalculateRange, DealWithMeal, ParseTsMPEISchedule } from "./Parsers/ScheduleParser.ts";
import {
  shouldEnterStudentsNotFoundState,
  type StudentAccountAuthenticationPhase,
} from "../Login/StudentAccountState";
import {
  loadingProgressService,
  type LoadingProgressSession,
} from "../Loading/LoadingProgressService";
import {
  getBARSSectionProgressKey,
  LOADING_PROGRESS_KEYS,
  type BARSDataSection,
} from "../Loading/LoadingProgressKeys";

export type LoginState =
  | 'LOGGED_IN'
  | 'NEED_2FA'
  | 'NOT_LOGGED_IN'
  | 'NOT_INITIATED'
  | 'AUTHENTICATED_LOADING_DATA'
  | 'STUDENTS_NOT_FOUND'

export type LoginResult =
  | 'ONLINE'
  | 'OFFLINE'
  | 'NEED_2FA'
  | 'STUDENTS_NOT_FOUND'
  | 'CANCELLED'
  | void
  | BARSMarks

export type AppIconName =
  | 'cool'
  | 'dragons'
  | 'simple'
  | 'matterial'
  | 'gold'
  | 'crymat'
  | 'crysign'

export type QRFrameName =
  | 'qr-frame'
  | 'empty'
  | 'qr-frame-black'
  | 'qr-frame-green'
  | 'qr-frame-red'

const QR_FRAME_NAMES: readonly QRFrameName[] = [
  'qr-frame',
  'empty',
  'qr-frame-black',
  'qr-frame-green',
  'qr-frame-red',
]

const BARS_ACCOUNT_STORAGE_KEYS = [
  STORAGE_KEYS.SCHEDULE,
  STORAGE_KEYS.MARKS,
  STORAGE_KEYS.STUDENT_INFO,
  STORAGE_KEYS.TASKS,
  STORAGE_KEYS.REPORTS,
  STORAGE_KEYS.BOOKS,
  STORAGE_KEYS.QUESTIONNAIRES,
  STORAGE_KEYS.STIPENDS,
  STORAGE_KEYS.ORDERS,
  STORAGE_KEYS.SKIPPED_CLASSES,
  STORAGE_KEYS.RECORD_BOOK,
  STORAGE_KEYS.MAIL,
  STORAGE_KEYS.ADDITIONAL_DATA,
] as const

const isQRFrameName = (value: unknown): value is QRFrameName => (
  typeof value === 'string' && QR_FRAME_NAMES.includes(value as QRFrameName)
)

type PostOnlineDataTask = () => Promise<void> | void

type DataSectionFetch = {
  generation: number
  promise: Promise<void>
}

type DataSectionState<T> = {
  status: 'LOADING' | 'LOADED' | 'OFFLINE' | 'FAILED'
  data: T | null
}

type CachedDataSectionOptions<T> = {
  section: BARSDataSection
  storageKey: string
  timeoutMs: number
  request: () => Promise<string>
  parse: (response: string) => T | ReturnType<typeof CreateBARSError>
  update: (state: DataSectionState<T>) => void
}

type StudentAccountLoginAttempt = {
  generation: number
  credentials: BARSCredentials
  isPrimaryOnlineAttempt: boolean
  authenticationPhase: StudentAccountAuthenticationPhase
  hasStudentData: boolean
}

class SessionInvalidatedError extends Error {}

export type TwoFactorProviderTid = 1 | 2 | 3 | 4 | 5

type SavedTemporary2FACode = {
  account: string
  code: string
}

type InvalidTwoFactorCodeError = ReturnType<typeof CreateBARSError> & {
  isInvalidTwoFactorCode: true
}

const createInvalidTwoFactorCodeError = (): InvalidTwoFactorCodeError => ({
  ...CreateBARSError('LOGIN_FAIL', 'Некорректный код подтверждения!'),
  isInvalidTwoFactorCode: true,
})

const isInvalidTwoFactorCodeError = (error: unknown): error is InvalidTwoFactorCodeError => (
  typeof error === 'object'
  && error !== null
  && isBARSError(error)
  && (error as {isInvalidTwoFactorCode?: unknown}).isInvalidTwoFactorCode === true
)

const isIconAlreadyUsedError = (error: unknown) => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as {code?: unknown}).code
    return typeof code === 'string' && code.startsWith('ANDROID:ICON_ALREADY_USED')
  }

  return error instanceof Error && error.message.includes('ANDROID:ICON_ALREADY_USED')
}

function Timeout<T>(ms: number, promise: Promise<T>): Promise<T> {
  return new Promise<T>(function(resolve, reject) {
    setTimeout(function() {
      reject(new Error("timeout"))
    }, ms);
    promise.then(resolve, reject)
  })
}

const GetAvailableSemesters = (raw: string): Semester[] => {
  const $ = parse(raw).querySelector('#ddl_StudyFilterSemester')!
  const result: Semester[] = []
  const $options = $!.querySelectorAll(`option`)
  for(let i of $options){

    const name = i.text
    const id = i.attributes['value']
    result.push({name, id})
  }
  return result
}

export default class BARS{
  private mBackgroundMode = false
  private mTestMode = false
  public mCurrentData: Partial<BARSData>
  public mCredentials: BARSCredentials = {login: '', password: ''}
  public mStorage = createMMKV()
  private mCurrentIcon: string = 'cool'
  public mCurrentWeek = ''
  private mDebts: BARSDiscipline[] = []
  private mCurrentFrame: QRFrameName = 'qr-frame';
  private mLoginState: LoginState = 'NOT_INITIATED'
  private mOnlineDataLoadPromise?: Promise<void>
  private mOnlineDataLoadGeneration?: number
  private mBackgroundDataLoadPromise?: Promise<void>
  private mBackgroundDataLoadGeneration?: number
  private mSectionFetches = new Map<BARSDataSection, DataSectionFetch>()
  private mPostOnlineDataTasks = new Map<string, PostOnlineDataTask>()
  private mLastRequested2FAProvider?: TwoFactorProviderTid
  private m2FACodeRequestPromise?: Promise<TwoFactorProviderTid | undefined>
  private mSessionGeneration = 0
  private mStudentAccountLoginAttempt?: StudentAccountLoginAttempt

  public get Debts() { return this.mDebts }
  public get LoginState() { return this.mLoginState }

  constructor() {
    //this.mStorage.clearAll()
    this.mCurrentData = {}
    getIcon().then((r: string = 'cool')=>{
      this.mCurrentIcon=r
    })
  }
  public get Week(){return this.mCurrentWeek}
  public SetLoginState(state: LoginState){
    if(this.mLoginState === state) return
    this.mLoginState = state
    DeviceEventEmitter.emit('LoginState', state)
  }

  private BeginSessionGeneration(): number {
    this.mSessionGeneration += 1
    this.mStudentAccountLoginAttempt = undefined
    this.mBackgroundDataLoadPromise = undefined
    this.mBackgroundDataLoadGeneration = undefined
    this.mSectionFetches.clear()
    return this.mSessionGeneration
  }

  private BeginLoginAttempt(
    credentials: BARSCredentials,
    isPrimaryOnlineAttempt: boolean,
  ): StudentAccountLoginAttempt {
    const attempt: StudentAccountLoginAttempt = {
      generation: this.BeginSessionGeneration(),
      credentials: {...credentials},
      isPrimaryOnlineAttempt,
      authenticationPhase: 'PASSWORD_SUBMITTED',
      hasStudentData: false,
    }
    this.mStudentAccountLoginAttempt = attempt
    this.mCredentials = {...credentials}
    return attempt
  }

  private IsCurrentGeneration(generation: number): boolean {
    return generation === this.mSessionGeneration
  }

  private IsCurrentStudentAccountAttempt(attempt: StudentAccountLoginAttempt): boolean {
    return this.IsCurrentGeneration(attempt.generation)
      && this.mStudentAccountLoginAttempt === attempt
  }

  private MarkTwoFactorAccepted(attempt: StudentAccountLoginAttempt) {
    if (this.IsCurrentStudentAccountAttempt(attempt)) {
      attempt.authenticationPhase = 'TWO_FACTOR_ACCEPTED'
    }
  }

  private GetStudentsNotFoundResult(attempt: StudentAccountLoginAttempt): LoginResult | undefined {
    if (!this.IsCurrentStudentAccountAttempt(attempt)) {
      return 'CANCELLED'
    }

    if (shouldEnterStudentsNotFoundState({
      isPrimaryOnlineAttempt: attempt.isPrimaryOnlineAttempt,
      authenticationPhase: attempt.authenticationPhase,
      hasStudentData: attempt.hasStudentData,
    })) {
      console.warn('Student account is not available after accepted 2FA')
      return 'STUDENTS_NOT_FOUND'
    }

    return undefined
  }

  private SaveStudentAccount(
    response: string,
    parsedStudent: BARSStudentInfo,
    credentials: BARSCredentials,
    isHeadman: boolean,
    attempt: StudentAccountLoginAttempt,
  ): Extract<LoginResult, 'ONLINE' | 'CANCELLED'> {
    if (!this.IsCurrentStudentAccountAttempt(attempt)) {
      return 'CANCELLED'
    }

    const availableSemesters = GetAvailableSemesters(response)
    const student = {...parsedStudent, headman: isHeadman}
    this.mCurrentData.availableSemesters = availableSemesters
    this.mCurrentData.student = student
    attempt.hasStudentData = true
    attempt.authenticationPhase = 'STUDENT_DATA_READY'
    this.mStorage.set(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentials))
    this.mStorage.set(STORAGE_KEYS.STUDENT_INFO, JSON.stringify(student))
    return 'ONLINE'
  }
  /**
   * These tasks run in the bounded background queue after the core BARS data
   * has unlocked navigation. VPN revalidation is registered here in stage 6.
   */
  public RegisterPostOnlineDataTask(name: string, task: PostOnlineDataTask){
    this.mPostOnlineDataTasks.set(name, task)
    return () => this.mPostOnlineDataTasks.delete(name)
  }
  private async RunPostOnlineDataTasks(generation: number){
    for(const [name, task] of this.mPostOnlineDataTasks){
      if (!this.IsCurrentGeneration(generation)) {
        return
      }
      try{
        await task()
      } catch {
        console.warn(`Post-online data task "${name}" failed`)
      }
    }
  }

  private GetDataSectionLabel(section: BARSDataSection): string {
    switch (section) {
      case 'marks': return 'Получение оценок...'
      case 'schedule': return 'Загрузка личного расписания...'
      case 'mail': return 'Проверка почты...'
      case 'skippedClasses': return 'Загрузка пропусков...'
      case 'recordBook': return 'Загрузка зачётной книжки...'
      case 'tasks': return 'Загрузка заданий...'
      case 'reports': return 'Загрузка отчётов...'
      case 'stipends': return 'Загрузка стипендий...'
      case 'orders': return 'Загрузка приказов...'
      case 'books': return 'Загрузка книг...'
      case 'questionnaires': return 'Загрузка анкет...'
    }
  }

  private GetDataSectionStatus(section: BARSDataSection): DataSectionState<unknown>['status'] {
    switch (section) {
      case 'marks': return Store.getState().MarkTable.status
      case 'schedule': return Store.getState().Schedule.status
      case 'mail': return Store.getState().Mail.status
      case 'skippedClasses': return Store.getState().SkippedClasses.status
      case 'recordBook': return Store.getState().RecordBook.status
      case 'tasks': return Store.getState().Tasks.status
      case 'reports': return Store.getState().Reports.status
      case 'stipends': return Store.getState().Stipends.status
      case 'orders': return Store.getState().Orders.status
      case 'books': return Store.getState().Books.status
      case 'questionnaires': return Store.getState().Questionnaires.status
    }
  }

  private SetDataSectionLoading(section: BARSDataSection) {
    switch (section) {
      case 'marks': Store.dispatch(updateMarkTable({status: 'LOADING', data: null})); return
      case 'schedule': Store.dispatch(updateSchedule({status: 'LOADING', data: null})); return
      case 'mail': Store.dispatch(updateMail({status: 'LOADING', data: null})); return
      case 'skippedClasses': Store.dispatch(updateSkippedClasses({status: 'LOADING', data: null})); return
      case 'recordBook': Store.dispatch(updateRecordBook({status: 'LOADING', data: null})); return
      case 'tasks': Store.dispatch(updateTasks({status: 'LOADING', data: null})); return
      case 'reports': Store.dispatch(updateReports({status: 'LOADING', data: null})); return
      case 'stipends': Store.dispatch(updateStipends({status: 'LOADING', data: null})); return
      case 'orders': Store.dispatch(updateOrders({status: 'LOADING', data: null})); return
      case 'books': Store.dispatch(updateBooks({status: 'LOADING', data: null})); return
      case 'questionnaires': Store.dispatch(updateQuestionnaires({status: 'LOADING', data: null})); return
    }
  }

  private FetchDataSection(section: BARSDataSection): Promise<unknown> {
    switch (section) {
      case 'marks': return this.FetchMarkTable()
      case 'schedule': return this.FetchSchedule()
      case 'mail': return this.FetchMail()
      case 'skippedClasses': return this.FetchSkippedClasses()
      case 'recordBook': return this.FetchRecordBook()
      case 'tasks': return this.FetchTasks()
      case 'reports': return this.FetchReports()
      case 'stipends': return this.FetchStipends()
      case 'orders': return this.FetchOrders()
      case 'books': return this.FetchBooks()
      case 'questionnaires': return this.FetchQuestionnaires()
    }
  }

  private RunDataSection(section: BARSDataSection, generation: number): Promise<void> {
    const activeFetch = this.mSectionFetches.get(section)
    if (activeFetch?.generation === generation) {
      return activeFetch.promise
    }

    const progress = loadingProgressService.start(
      getBARSSectionProgressKey(section),
      this.GetDataSectionLabel(section),
    )
    const promise = (async () => {
      try {
        await this.FetchDataSection(section)
        if (!this.IsCurrentGeneration(generation)) {
          return
        }
        loadingProgressService.complete(
          progress,
          this.GetDataSectionStatus(section) === 'LOADED' ? 'success' : 'failed',
        )
      } catch (error) {
        if (!this.IsCurrentGeneration(generation)) {
          return
        }
        loadingProgressService.fail(progress)
        console.warn(`BARS data section "${section}" failed`, error)
      }
    })()

    this.mSectionFetches.set(section, {generation, promise})
    void promise.then(() => {
      if (this.mSectionFetches.get(section)?.promise === promise) {
        this.mSectionFetches.delete(section)
      }
    })
    return promise
  }

  public RetryDataSection(section: BARSDataSection): Promise<void> {
    const generation = this.mSessionGeneration
    const activeFetch = this.mSectionFetches.get(section)
    if (activeFetch?.generation === generation) {
      return activeFetch.promise
    }

    this.SetDataSectionLoading(section)
    return this.RunDataSection(section, generation)
  }

  private StartBackgroundDataLoad(generation: number) {
    if (this.mBackgroundDataLoadPromise && this.mBackgroundDataLoadGeneration === generation) {
      return
    }

    const backgroundPromise = (async () => {
      const run = async (section: BARSDataSection) => {
        if (this.IsCurrentGeneration(generation)) {
          await this.RunDataSection(section, generation)
        }
      }

      // Personal schedule is intentionally first, but it no longer delays entry.
      await run('schedule')

      if (this.IsCurrentGeneration(generation) && this.mCurrentData.availableSemesters?.length) {
        try {
          await this.FilterAvailableSemesters(this.mCurrentData.availableSemesters)
        } catch (error) {
          console.warn('Available semesters filtering failed', error)
        }
      }

      for (const section of [
        'mail',
        'skippedClasses',
        'recordBook',
        'tasks',
        'reports',
        'stipends',
        'orders',
        'books',
        'questionnaires',
      ] as const) {
        await run(section)
      }

      if (this.IsCurrentGeneration(generation)) {
        await this.RunPostOnlineDataTasks(generation)
      }
    })()

    this.mBackgroundDataLoadPromise = backgroundPromise
    this.mBackgroundDataLoadGeneration = generation
    void backgroundPromise.then(() => {
      if (this.mBackgroundDataLoadPromise === backgroundPromise) {
        this.mBackgroundDataLoadPromise = undefined
        this.mBackgroundDataLoadGeneration = undefined
      }
    })
  }

  private async FetchCachedDataSection<T>(options: CachedDataSectionOptions<T>): Promise<void> {
    const generation = this.mSessionGeneration
    try {
      const response = await Timeout(options.timeoutMs, options.request())
      const data = options.parse(response)
      if (isBARSError(data)) {
        throw data
      }
      if (!this.IsCurrentGeneration(generation)) {
        return
      }
      this.mStorage.set(options.storageKey, JSON.stringify(data))
      options.update({status: 'LOADED', data})
    } catch (error) {
      if (!this.IsCurrentGeneration(generation)) {
        return
      }
      console.warn(`Failed to fetch ${options.section}; trying offline data`, error)
      const cached = this.mStorage.getString(options.storageKey)
      if (cached) {
        try {
          options.update({status: 'OFFLINE', data: JSON.parse(cached) as T})
          return
        } catch (cachedError) {
          console.warn(`Saved ${options.section} data is invalid`, cachedError)
        }
      }
      options.update({status: 'FAILED', data: null})
      throw error
    }
  }
  public async ChangeIcon(name: AppIconName): Promise<boolean>{
    if(this.mCurrentIcon === name) return false

    try{
      await changeIcon(name)
    } catch(error){
      if(isIconAlreadyUsedError(error)){
        this.mCurrentIcon = name
        return false
      }
      throw error
    }

    this.mCurrentIcon = name
    console.log('Icon changed to ' + name)
    return true
  }
  public ChangeFrame(name: QRFrameName){
    this.mCurrentFrame = name
    this.mStorage.set(STORAGE_KEYS.FRAME, name)
    console.log('QR Scanner frame changed to ' + name)
  }
  public get Icon(){return this.mCurrentIcon}

  public get QRFrame(): QRFrameName {
    const frameRaw = this.mStorage.getString(STORAGE_KEYS.FRAME)
    if (isQRFrameName(frameRaw)) {
      this.mCurrentFrame = frameRaw
      return frameRaw
    }

    this.mCurrentFrame = 'qr-frame'
    this.mStorage.set(STORAGE_KEYS.FRAME, this.mCurrentFrame)
    return this.mCurrentFrame
  }

  public Init(backgroundMode: boolean){

    this.mBackgroundMode = backgroundMode
    const result = this.mStorage.getString(STORAGE_KEYS.CREDENTIALS)
    if(typeof result != 'undefined' && result != ''){
      try{
        this.mCredentials = JSON.parse(result) as BARSCredentials
      } catch (e){
        console.error('Error in BARS::Init()', e)
        //Promise.resolve(false);
      }
      console.log('Found credentials');
      const loginFlow = () => {
        return this.Login(this.mCredentials, false).then((mode: LoginResult)=> {
          if(mode == 'ONLINE'){
            return this.LoadOnlineData().finally(()=>{
              LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
            })
          } else if (mode == 'OFFLINE'){
            const generation = this.mSessionGeneration
            this.LoadOfflineData()
            setTimeout(()=>{
              if (this.IsCurrentGeneration(generation)) {
                this.SetLoginState('LOGGED_IN')
              }
            }, 500)
          } else if (mode == 'NEED_2FA'){
            const generation = this.mSessionGeneration
            LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
            setTimeout(()=>{
              if (this.IsCurrentGeneration(generation)) {
                this.SetLoginState('NEED_2FA')
              }
            }, 100)
          } else if (mode == 'CANCELLED') {
            return
          } else {
            console.warn('VOID MODE !')
            throw 'VOID MODE'
          }
        }).catch((e)=>{
          if(isBARSError(e)){
            Alert.alert('Ошибка', e.message)
          } else {
            console.error('BARSAPI::Login()', e)
          }
          if(!backgroundMode){
            this.SetLoginState('NOT_LOGGED_IN')
          }
          return
        })
      }
      const restoreGeneration = this.BeginSessionGeneration()
      try{
        const student = this.mStorage.getString(STORAGE_KEYS.STUDENT_INFO);
        if(typeof student != 'undefined' && student != ''){
          const studentID = JSON.parse(student).id
          const link = 'https://bars.mpei.ru/bars_web/ST_Study/Main/Main?studentID=' + studentID
          return fetch(link, {
            method: 'GET',
            headers: COMMON_HTTP_HEADER,
            mode: 'same-origin',
            credentials: 'include'
          }).then(r=>r.text()).then((response)=>{
            if (!this.IsCurrentGeneration(restoreGeneration)) {
              return
            }
            const result = ParseStudentInfo(response)
            if (isBARSError(result)) {
              throw result
            }
            const availableSemesters = GetAvailableSemesters(response)
            if (!this.IsCurrentGeneration(restoreGeneration)) {
              return
            }
            this.mCurrentData.availableSemesters = availableSemesters
            this.mCurrentData.student = result as BARSStudentInfo;
            this.mStorage.set(STORAGE_KEYS.STUDENT_INFO, JSON.stringify(result))
            console.log('Successfully restored session and updated student info! Loading account data...');
            return this.LoadOnlineData().finally(()=>{
              LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
            })
          }).catch(()=>{
            if (!this.IsCurrentGeneration(restoreGeneration)) {
              return
            }
            console.warn('Failed to restore session(request failed/bad response)! Trying to login again...');
            return loginFlow()
          })
        } else {
          console.warn('Failed to restore session(no student info)! Trying to login again...');
          return loginFlow()
        }
      } catch (e:any) {
        console.warn('Trying to login again - failed to restore session: ' + e.toString() + '');
        return loginFlow()
      }
    } else {
      console.log('Credentials not found');
      const generation = this.BeginSessionGeneration()
      this.mCredentials = {login: '', password: ''}
      if(!backgroundMode){
        setTimeout(()=>{
          if (this.IsCurrentGeneration(generation)) {
            this.SetLoginState('NOT_LOGGED_IN')
          }
        }, 500)
      }
      return Promise.resolve(false);
    }
  }



  public get Theme(){
    const themeRaw = this.mStorage.getString(STORAGE_KEYS.THEME)
    if(typeof themeRaw == 'undefined' && themeRaw != ''){
      this.mStorage.set(STORAGE_KEYS.THEME, APP_CONFIG.DEFAULT_THEME)
      return APP_CONFIG.DEFAULT_THEME == 'dark' ? THEME_DARK : THEME_LIGHT
    } else {
      try{
        return themeRaw == 'dark' ? THEME_DARK : THEME_LIGHT
      } catch (e){
        return APP_CONFIG.DEFAULT_THEME == 'dark' ? THEME_DARK : THEME_LIGHT
      }
    }
  }
  public SetTheme(name: string){
    this.mStorage.set(STORAGE_KEYS.THEME, name)
    DeviceEventEmitter.emit('SET_THEME', name)
  }

  public GetCreds(){
    let user_creds: BARSCredentials
    user_creds = {login: '', password: ''}
    try {
      user_creds = JSON.parse(<string>this.mStorage.getString(STORAGE_KEYS.CREDENTIALS))
    } catch (e) {
      user_creds.login = ''
      user_creds.password = ''
    }
    return user_creds
}

  private ClearBARSAccountData(){
    for(const key of BARS_ACCOUNT_STORAGE_KEYS){
      this.mStorage.remove(key)
    }
    Store.dispatch(updateSchedule({status: "LOADING", data: null}))
    Store.dispatch(updateMail({status: "LOADING", data: null}))
    Store.dispatch(updateSkippedClasses({status: "LOADING", data: null}))
    Store.dispatch(updateRecordBook({status: "LOADING", data: null}))
    Store.dispatch(updateTasks({status: "LOADING", data: null}))
    Store.dispatch(updateReports({status: "LOADING", data: null}))
    Store.dispatch(updateStipends({status: "LOADING", data: null}))
    Store.dispatch(updateOrders({status: "LOADING", data: null}))
    Store.dispatch(updateBooks({status: "LOADING", data: null}))
    Store.dispatch(updateQuestionnaires({status: "LOADING", data: null}))
    Store.dispatch(updateMarkTable({status: "LOADING", data: null}))
    Store.dispatch(updateAdditionalData({status: "LOADING", data: null}))
    this.mCurrentData = {}
    this.mCurrentWeek = ''
    this.mDebts = []
    this.mTestMode = false
  }

  public Logout(){
    this.BeginSessionGeneration()
    this.mStorage.remove(STORAGE_KEYS.CREDENTIALS)
    this.mStorage.remove(STORAGE_KEYS.TEMPORARY_2FA_CODE)
    this.ClearBARSAccountData()
    this.mCredentials = {login: '', password: ''}
    this.mLastRequested2FAProvider = undefined
    this.m2FACodeRequestPromise = undefined
    this.SetLoginState('NOT_LOGGED_IN')
  }

  /** Debug-only full reset retained for the existing Settings action. */
  public ClearStorage(){
    this.Logout()
    for(const key of this.mStorage.getAllKeys()){
      this.mStorage.remove(key)
    }
    this.mStorage.clearAll()
  }

  public EnterStudentsNotFoundState(): boolean {
    const attempt = this.mStudentAccountLoginAttempt
    if (!attempt || this.GetStudentsNotFoundResult(attempt) !== 'STUDENTS_NOT_FOUND') {
      return false
    }

    const credentials = {...attempt.credentials}
    this.BeginSessionGeneration()
    this.ClearBARSAccountData()
    this.mCredentials = credentials
    this.mStorage.set(STORAGE_KEYS.CREDENTIALS, JSON.stringify(credentials))
    this.SetLoginState('STUDENTS_NOT_FOUND')
    return true
  }

  public async RetryStudentAccountCheck(): Promise<void> {
    const credentials = {...this.mCredentials}
    if (!credentials.login || !credentials.password) {
      this.Logout()
      return
    }

    this.SetLoginState('AUTHENTICATED_LOADING_DATA')
    const loginPromise = this.Login(credentials, true)
    const attempt = this.mStudentAccountLoginAttempt

    try {
      const result = await loginPromise
      if (!attempt || !this.IsCurrentStudentAccountAttempt(attempt) || result === 'CANCELLED') {
        return
      }

      if (result === 'ONLINE') {
        await this.LoadOnlineData()
        return
      }

      if (result === 'NEED_2FA') {
        this.SetLoginState('NEED_2FA')
        return
      }

      if (result === 'STUDENTS_NOT_FOUND') {
        this.EnterStudentsNotFoundState()
        return
      }

      throw CreateBARSError('LOGIN_FAIL', 'Не удалось повторно проверить аккаунт БАРС.')
    } catch (error) {
      if (!attempt || !this.IsCurrentStudentAccountAttempt(attempt)) {
        return
      }
      Alert.alert('Ошибка!', isBARSError(error) ? error.message : String(error))
      this.SetLoginState('NOT_LOGGED_IN')
    }
  }

  private FetchCurrentWeek(){
    const generation = this.mSessionGeneration
    console.time('CurrentWeek ' + Platform.OS)
    return Timeout(15000, fetch('https://mpei.ru/Education/timetable/Pages/default.aspx',{
      method: 'GET',
      headers: COMMON_HTTP_HEADER,
      credentials: 'include'
    }).then(r=>r.text()).then((r)=>{
      try{
        const doc = parse(r)
        if (this.IsCurrentGeneration(generation)) {
          this.mCurrentWeek = doc.querySelector('.nb-week')?.textContent?.trim() ??
            doc.querySelector('.current-study-week')?.textContent?.match(/\d+/)?.[0] ??
            '?';
        }
        console.timeEnd('CurrentWeek ' + Platform.OS)
      } catch (e: any){
        if (this.IsCurrentGeneration(generation)) {
          this.mCurrentWeek = '?'
        }
        console.warn("Failed to get current week")
        console.timeEnd('CurrentWeek ' + Platform.OS)
      } finally {
        return Promise.resolve();
      }
    })).catch(e => {
      if (this.IsCurrentGeneration(generation)) {
        this.mCurrentWeek = '?'
      }
      console.warn("Data download time exceeded on current week!", e)
    })
  }

  public LoadOnlineData(): Promise<void>{
    const generation = this.mSessionGeneration
    if(this.mOnlineDataLoadPromise && this.mOnlineDataLoadGeneration === generation) {
      return this.mOnlineDataLoadPromise
    }

    const loadPromise = this.LoadOnlineDataInternal(generation).finally(()=>{
      if (this.mOnlineDataLoadPromise === loadPromise) {
        this.mOnlineDataLoadPromise = undefined
        this.mOnlineDataLoadGeneration = undefined
      }
    })
    this.mOnlineDataLoadPromise = loadPromise
    this.mOnlineDataLoadGeneration = generation
    return loadPromise
  }

  private async LoadOnlineDataInternal(generation: number): Promise<void>{
    if (!this.IsCurrentGeneration(generation)) {
      return
    }
    this.SetLoginState('AUTHENTICATED_LOADING_DATA')
    const progress = loadingProgressService.start(
      LOADING_PROGRESS_KEYS.authenticatedData,
      'Получение основных учебных данных...',
    )
    let coreFailed = false
    let shouldStartBackgroundLoad = true

    try{
      if (APP_CONFIG.TEST_MODE && Compare(APP_CONFIG.TEST_CREDS, this.mCredentials)) {
        this.mCurrentData = TEST_DATA
        shouldStartBackgroundLoad = false
        return
      }

      const initialAddData: AdditionalData = {
        finalMarkAvailabilityCounter: 0
      }
      Store.dispatch(updateAdditionalData({status: "LOADED", data: initialAddData}))
      this.mStorage.set(STORAGE_KEYS.ADDITIONAL_DATA, JSON.stringify(initialAddData))

      const fetchDebts = async () => {
        const availableSemesters = this.mCurrentData.availableSemesters
        if (!availableSemesters || availableSemesters.length <= 1) {
          return
        }

        const result = await this.FetchMarkTable(availableSemesters[1].id, true)
        const marks = result as BARSMarks | void
        if (!marks?.disciplines || !this.IsCurrentGeneration(generation)) {
          return
        }

        const debts: BARSDiscipline[] = []
        for (const discipline of marks.disciplines) {
          const lastMark = discipline.resultMarks[discipline.resultMarks.length - 1]?.mark
          if (lastMark && new RegExp(/[0-2]/gm).test(lastMark)) {
            discipline.debt = true
            debts.push(discipline)
            console.log('Pushed debt: ' + discipline.name + ' - ' + lastMark)
          }
        }
        this.mDebts = debts
      }

      const coreResults = await Promise.allSettled([
        this.FetchCurrentWeek(),
        this.FetchMarkTable(),
        fetchDebts(),
      ])
      if (!this.IsCurrentGeneration(generation)) {
        return
      }

      coreFailed = coreResults.some(result => result.status === 'rejected')
        || this.GetDataSectionStatus('marks') !== 'LOADED'
      loadingProgressService.advance(
        progress,
        'Подготовка основных разделов...',
        coreFailed ? 'failed' : 'success',
      )
      console.log('Core online data fetch completed')
    } catch(error){
      if (error instanceof SessionInvalidatedError || !this.IsCurrentGeneration(generation)) {
        return
      }
      coreFailed = true
      console.warn('Core online data loading failed', error)
    } finally {
      if (!this.IsCurrentGeneration(generation)) {
        return
      }
      loadingProgressService.complete(progress, coreFailed ? 'failed' : 'success')
      if (this.IsCurrentGeneration(generation)) {
        this.SetLoginState('LOGGED_IN')
        if (shouldStartBackgroundLoad) {
          this.StartBackgroundDataLoad(generation)
        }
      }
    }
  }

  public async FilterAvailableSemesters(sems: Semester[]): Promise<void>{
    const generation = this.mSessionGeneration
    const check = (sem: Semester) => {
      let link = URLS.BARS_MAIN + 'ST_Study/Main/Main?studentID=' + this.mCurrentData.student!.id
      if(typeof sem.id != "undefined"){
        link+= '&query='+
            JSON.stringify({
              'ID': this.mCurrentData.student!.id,
              'FilterSemester': {'value': sem.id}
            })
      }
      link = encodeURI(link)
      return fetch(link, {
        method: 'GET',
        headers: COMMON_HTTP_HEADER,
        mode: 'same-origin',
        credentials: 'include'
      }).then((r=>r.text())).then((response)=>{
        try {
          const $ = parse(response).querySelectorAll('.hr-separator')!

          return {sem, available: $.length - 4 != 0 }
        } catch (e: any){
          throw CreateBARSError('SEMESTER_FILTER_FAIL', e)
        }
      })
    }
    const results = await Promise.all(sems.map(check))
    if (!this.IsCurrentGeneration(generation)) {
      return
    }
    const available: Semester[] = []
    for(const result of results){
      if(result.available){
        available.push(result.sem)
      }
    }
    this.mCurrentData.availableSemesters = available
    DeviceEventEmitter.emit('refresh_semSelector')
  }
  public get TestMode(){return this.mTestMode}

  private HandleLoginResponse(
    response: string,
    creds: BARSCredentials,
    attempt: StudentAccountLoginAttempt,
  ): Promise<LoginResult> {
    if (!this.IsCurrentStudentAccountAttempt(attempt)) {
      return Promise.resolve('CANCELLED')
    }
    this.mCurrentData = {}
    if (response.includes("Студенты") || response.includes('На главную')) { //multi-account or EditUser page
      const isHeadman = response.includes("Студенты") && response.includes("Отчёты")
      return fetch(URLS.BARS_MULTI_ACCOUNT, {
        method: "GET",
        headers: COMMON_HTTP_HEADER,
        mode: 'same-origin',
        credentials: 'include'
      }).then(r => r.text()).then((response) => {
        const $ = cheerio.load(response);
        const last = $("#tbl__PartialListStudent > tbody").find("tr").length;
        let target_acc = last
        let acc_status = $(`#tbl__PartialListStudent > tbody > tr:nth-child(${last}) > td:nth-child(3)`)[0].children[0].data
        if (acc_status.includes('отчислен') || acc_status.includes('завершил обучение')){
          console.log('"Expelled"/"Сompleted study" in the last account! An attempt to find a valid one...')
          for (let i = (last - 1); i >= 1; i--) {
            let textForCheck = $(`#tbl__PartialListStudent > tbody > tr:nth-child(${i}) > td:nth-child(3)`)[0].children[0].data
            if (!textForCheck.includes("отчислен") && !textForCheck.includes("завершил обучение")) {
              target_acc = i
              console.log('An active account has been detected! Authorization has been redirected to it.')
              break
            }
          }
        }
        const id = $(`#tbl__PartialListStudent > tbody > tr:nth-child(${target_acc}) > td:nth-child(1) > a`).attr("href").trim()
        const link = URLS.BARS_MAIN + id.replace("/bars_web/", "")

        return fetch(link, {
          method: "GET",
          headers: COMMON_HTTP_HEADER,
          mode: 'same-origin',
          credentials: 'include'
        }).then(r => r.text()).then((response) => {
          if (!(response.includes("Оценки в БАРС"))) {
            console.warn("Not main BARS page during multi-account login! An attempt to redirect...")
            try {
              let studentID = response.split('studentID=')[1].split('"')[0]
              console.warn('studentID= ' + studentID)
              return fetch('https://bars.mpei.ru/bars_web/ST_Study/Main/Main?studentID=' + studentID, {
                method: "GET",
                headers: COMMON_HTTP_HEADER,
                mode: 'same-origin',
                credentials: 'include'
              }).then(r => r.text()).then((response) => {
                console.log("Successfully redirected and logged in multi-account")
                const result = ParseStudentInfo(response)

                if (isBARSError(result)) throw result;

                const loginResult = this.SaveStudentAccount(
                  response,
                  result as BARSStudentInfo,
                  creds,
                  isHeadman,
                  attempt,
                )
                if (loginResult === 'ONLINE') {
                  console.timeEnd('Login&StudentInfoParser')
                  console.log(this.mCurrentData.student)
                }
                return loginResult
              })
            } catch (e:any) {
              console.warn('ERROR: ' + e.toString())
              throw CreateBARSError("SERVER_ERROR", "Сервер вернул неожиданный результат! Попробуйте ещё раз. Если снова увидите эту ошибку, пожалуйста, сообщите разработчикам!")
            }
          } else {
            console.log("Successfully logged in multi-account / from EditUser page");

            const result = ParseStudentInfo(response)

            if (isBARSError(result)) throw result;

            const loginResult = this.SaveStudentAccount(
              response,
              result as BARSStudentInfo,
              creds,
              isHeadman,
              attempt,
            )
            if (loginResult === 'ONLINE') {
              console.timeEnd('Login&StudentInfoParser')
              console.log(this.mCurrentData.student)
            }
            return loginResult
          }
        })
      })
    } else if (response.includes("Логин состоит из символов латинского алфавита и")) {
      throw CreateBARSError("INVALID_CREDS", "Неверный логин/пароль!")
    } else if (!(response.includes("Оценки в БАРС"))) {
      console.warn("Not main BARS page! An attempt to redirect...")
      try {
        let studentID = response.split('studentID=')[1].split('"')[0]
        console.warn('studentID= ' + studentID)
        return fetch('https://bars.mpei.ru/bars_web/ST_Study/Main/Main?studentID=' + studentID, {
          method: "GET",
          headers: COMMON_HTTP_HEADER,
          mode: 'same-origin',
          credentials: 'include'
        }).then(r => r.text()).then((response) => {
          console.log("Successfully redirected and logged in")
          const result = ParseStudentInfo(response)
          if (isBARSError(result)) {
            console.error("BARS error detected!")
            throw result;
          }

          const loginResult = this.SaveStudentAccount(
            response,
            result as BARSStudentInfo,
            creds,
            false,
            attempt,
          )
          if (loginResult === 'ONLINE') {
            console.timeEnd('Login&StudentInfoParser')
            console.log(this.mCurrentData.student)
          }
          return loginResult
        })
      } catch (e:any) {
        console.warn('ERROR: ' + e.toString())
        throw CreateBARSError("SERVER_ERROR", "Сервер вернул неожиданный результат! Попробуйте ещё раз. Если снова увидите эту ошибку, пожалуйста, сообщите разработчикам!")
      }
    } else if (response.includes("Рейтинг")) {
      console.log("Successfully logged in")
      const result = ParseStudentInfo(response)
      if (isBARSError(result)) {
        console.error("BARS error detected!")
        throw result;
      }

      const loginResult = this.SaveStudentAccount(
        response,
        result as BARSStudentInfo,
        creds,
        false,
        attempt,
      )
      if (loginResult === 'ONLINE') {
        console.timeEnd('Login&StudentInfoParser')
        console.log(this.mCurrentData.student)
      }
      return Promise.resolve(loginResult)
    }
    return Promise.reject(CreateBARSError('LOGIN_FAIL', "Сервер вернул неожиданный результат!"))
  }

  private GetSavedTemporary2FACode(account: string): string | undefined {
    const savedCodeRaw = this.mStorage.getString(STORAGE_KEYS.TEMPORARY_2FA_CODE)
    if (!savedCodeRaw) {
      return undefined
    }

    try {
      const savedCode = JSON.parse(savedCodeRaw) as Partial<SavedTemporary2FACode>
      if (typeof savedCode.account !== 'string' || typeof savedCode.code !== 'string' || !savedCode.code.trim()) {
        this.mStorage.remove(STORAGE_KEYS.TEMPORARY_2FA_CODE)
        return undefined
      }

      return savedCode.account === account ? savedCode.code : undefined
    } catch {
      this.mStorage.remove(STORAGE_KEYS.TEMPORARY_2FA_CODE)
      return undefined
    }
  }

  private SaveTemporary2FACode(account: string, code: string) {
    const normalizedCode = code.trim()
    if (!account || !normalizedCode) {
      return
    }

    this.mStorage.set(STORAGE_KEYS.TEMPORARY_2FA_CODE, JSON.stringify({account, code: normalizedCode}))
    console.log('Saved temporary 2FA code for the next session')
  }

  private ClearSavedTemporary2FACode() {
    this.mStorage.remove(STORAGE_KEYS.TEMPORARY_2FA_CODE)
  }

  private async HandleTwoFactorChallenge(): Promise<LoginResult> {
    const attempt = this.mStudentAccountLoginAttempt
    if (!attempt || !this.IsCurrentStudentAccountAttempt(attempt)) {
      return 'CANCELLED'
    }

    attempt.authenticationPhase = 'AWAITING_2FA'
    const savedTemporaryCode = this.GetSavedTemporary2FACode(attempt.credentials.login)
    if (!savedTemporaryCode) {
      void this.Start2FACodeRequest()
      return 'NEED_2FA'
    }

    console.log('Trying saved temporary 2FA code')
    this.mLastRequested2FAProvider = 4
    try {
      return await this.Login2FA(savedTemporaryCode)
    } catch (error) {
      if (!isInvalidTwoFactorCodeError(error)) {
        throw error
      }

      console.warn('Saved temporary 2FA code was rejected; falling back to configured providers')
      this.ClearSavedTemporary2FACode()
      void this.Start2FACodeRequest()
      return 'NEED_2FA'
    }
  }

  public Login2FA(code: string): Promise<LoginResult> {
    console.log('Trying to login with 2FA code');
    const attempt = this.mStudentAccountLoginAttempt
    if (!attempt || !this.IsCurrentStudentAccountAttempt(attempt)) {
      return Promise.resolve('CANCELLED')
    }

    const creds = attempt.credentials
    return Timeout(15000, fetch(URLS.BARS_LOGIN_CODE, {
      method: 'POST',
      headers: LOGIN_HEADER,
      body: JSON.stringify({
        Account: creds.login,
        AF2_Code: code,
        RememberMe: true
      })
    }).then(r => r.text())
      .then(response => {
        if (!this.IsCurrentStudentAccountAttempt(attempt)) {
          return 'CANCELLED'
        }
        if (response.includes("запрещён")) {
          return Promise.reject(CreateBARSError('LOGIN_FAIL', "Не удалось войти с использованием двухфакторной аутентификации!"));
        } else if (response.includes("Некорректный код подтверждения")) {
          return Promise.reject(createInvalidTwoFactorCodeError())
        }
        this.MarkTwoFactorAccepted(attempt)
        return this.HandleLoginResponse(response, creds, attempt);
      })
    ).then(result => {
      if (!this.IsCurrentStudentAccountAttempt(attempt)) {
        return 'CANCELLED'
      }
      if (this.mLastRequested2FAProvider === 4) {
        this.SaveTemporary2FACode(creds.login, code)
      }
      return result
    }).catch(e => {
      if (!this.IsCurrentStudentAccountAttempt(attempt)) {
        return Promise.resolve<LoginResult>('CANCELLED')
      }
      if (isInvalidTwoFactorCodeError(e)) {
        return Promise.reject(e)
      }

      const studentsNotFoundResult = this.GetStudentsNotFoundResult(attempt)
      if (studentsNotFoundResult) {
        return Promise.resolve(studentsNotFoundResult)
      }

      if (isBARSError(e) && (e.error == 'INVALID_CREDS' || e.error == 'LOGIN_FAIL')) {
        console.warn('Incorrect 2FA code!', e)
        return Promise.reject(CreateBARSError('LOGIN_FAIL', "Некорректный код подтверждения!"))
      } else {
        console.warn("Data download time exceeded on 2FA!", e)
        return Promise.reject(CreateBARSError('LOGIN_FAIL', "Превышено время загрузки данных - проблемы с интернетом или на стороне БАРС! Проверьте качество сети, а также настройки 2ФА на сайте БАРС МЭИ(в том числе, привязку MAX), и попробуйте снова позже. Если проблема сохраняется - сообщите разработчику(кнопка 'Поддержка')!"))
      }

    });
  }

  /**
   * Запрашивает код только у следующего провайдера после неуспеха предыдущего.
   * tid 1 — Telegram, 2 — ВКонтакте, 3 — MAX, 4 — временные коды, 5 — TOTP.
   * Порядок 5 → 2 → 3 → 4 → 1 ставит первыми TOTP и VK как наиболее удобные
   * независимые варианты, затем обязательный для многих MAX и временные коды;
   * Telegram остаётся последним, поскольку сейчас доставка кодов из БАРС
   * блокируется в РФ.
   */
  private async Request2FACode(generation: number): Promise<TwoFactorProviderTid | undefined> {
    const providerOrder: TwoFactorProviderTid[] = [5, 2, 3, 4, 1]
    this.mLastRequested2FAProvider = undefined

    for (const tid of providerOrder) {
      try {
        await new Promise<void>(resolve => setTimeout(resolve, 100));
        if (!this.IsCurrentGeneration(generation)) {
          return undefined
        }
        const response = await fetch(URLS.BARS_REQUEST_CODE + `?tid=${tid}`, {
          method: "GET",
          headers: COMMON_HTTP_HEADER,
        });
        const text = await response.text();
        if (!this.IsCurrentGeneration(generation)) {
          return undefined
        }
        console.log(`2FA code ${tid} requested, res: ${text}`);

        if (text.includes("success") && !text.includes("false")) {
          this.mLastRequested2FAProvider = tid
          return tid
        }

        // Проверяем на ошибку отправки и добавляем задержку перед следующей попыткой
        if (text.toLowerCase().includes("ошибка при отправке")) {
          console.warn(`2FA code ${tid} send error detected, waiting 10 seconds before next attempt`);
          await new Promise<void>(resolve => setTimeout(resolve, 10000));
          if (!this.IsCurrentGeneration(generation)) {
            return undefined
          }
        }
      } catch (e: any) {
        console.warn(`2FA code ${tid} request failed!`, e);
      }
    }

    return undefined
  }

  private Start2FACodeRequest(): Promise<TwoFactorProviderTid | undefined> {
    this.m2FACodeRequestPromise = this.Request2FACode(this.mSessionGeneration)
    return this.m2FACodeRequestPromise
  }

  public WaitFor2FACodeRequest(): Promise<TwoFactorProviderTid | undefined> {
    return this.m2FACodeRequestPromise ?? Promise.resolve(this.mLastRequested2FAProvider)
  }

  public Login(creds: BARSCredentials, firstStart: boolean = true): Promise<LoginResult>{
    let isIncorrectLoginPassword = false
    const attempt = this.BeginLoginAttempt(creds, firstStart)
    this.mLastRequested2FAProvider = undefined
    this.m2FACodeRequestPromise = undefined
    if(APP_CONFIG.TEST_MODE && Compare(APP_CONFIG.TEST_CREDS, creds)){
      // Alert.alert('Info', 'Entered test mode.')
      this.mCurrentData = require('../Common/TestData.json')
      attempt.hasStudentData = true
      attempt.authenticationPhase = 'STUDENT_DATA_READY'
      this.mTestMode = true
      console.log('Dispatching test data...')
      this.FetchSchedule()
      Store.dispatch(updateSkippedClasses({status: "LOADED", data: this.mCurrentData.skippedClasses!}))
      Store.dispatch(updateRecordBook({status: "LOADED", data: this.mCurrentData.records!}))
      Store.dispatch(updateReports({status: "LOADED", data: this.mCurrentData.reports!}))
      Store.dispatch(updateMarkTable({status: "LOADED", data: this.mCurrentData.marks!}))

      Store.dispatch(updateBooks({status: "OFFLINE", data: { books: [], library_card: 'empty' }}))
      Store.dispatch(updateMail({status: "OFFLINE", data: { mode: 'legacy', unreadCount: '0' }}))
      Store.dispatch(updateOrders({status: "OFFLINE", data: []}))
      Store.dispatch(updateQuestionnaires({status: "OFFLINE", data: []}))
      Store.dispatch(updateStipends({status: "OFFLINE", data: { stipends: [], petitions: [] }}))
      Store.dispatch(updateTasks({status: "OFFLINE", data: []}))

      console.log('Dispatched test data.')
      return Promise.resolve('ONLINE')
    }

    const CheckInternet = () => {
      return NetInfo.fetch()
    }

    return CheckInternet().then((response)=> {
      if (!this.IsCurrentStudentAccountAttempt(attempt)) {
        return Promise.resolve<LoginResult>('CANCELLED')
      }
      if (!(response.isConnected) && firstStart)
        return Promise.reject(CreateBARSError('LOGIN_FAIL', 'Нет подключения к интернету!'))
      else if (!(response.isConnected)) {
        return Promise.resolve<LoginResult>('OFFLINE')
      }
      console.time('Login&StudentInfoParser')
      let ms_bars_main = 6500
      if (firstStart) ms_bars_main = 30000
      return Timeout(ms_bars_main, fetch(URLS.BARS_MAIN, {
        method: 'POST',
        headers: LOGIN_HEADER,
        body: JSON.stringify({
          Account: creds.login,
          Password: creds.password,
          RememberMe: true
        }),
        credentials: 'include'
      }).then(async (response) => {
        let str = await response.text()
        if (str.includes("sod=1")) {
          console.warn("User + sod=1 variant login!")
          return fetch('https://bars.mpei.ru/bars_web/?sod=1', {
            method: "GET",
            headers: COMMON_HTTP_HEADER,
            credentials: 'include'
          })
        } else return fetch(URLS.BARS_MAIN, {
          method: 'POST',
          headers: LOGIN_HEADER,
          body: JSON.stringify({
            Account: creds.login,
            Password: creds.password,
            RememberMe: true
          }),
          credentials: 'include'
        })
      })
        .then(r => r.text())
        .then((response) => {
          if (!this.IsCurrentStudentAccountAttempt(attempt)) {
            return 'CANCELLED'
          }
          if (response.includes("код подтверждения")) {
            attempt.authenticationPhase = 'AWAITING_2FA'
            return 'NEED_2FA'
          }
          return this.HandleLoginResponse(response, creds, attempt);
        }).catch((e: any) => {
          if (!this.IsCurrentStudentAccountAttempt(attempt)) {
            return Promise.resolve<LoginResult>('CANCELLED')
          }
          if (isBARSError(e)) return Promise.reject(e)
          else {
            if (e.toString().includes('querySelector')){
              return Promise.reject(CreateBARSError('LOGIN_FAIL', 'Нет доступа к личному кабинету студента - вы не настроили 2ФА/не привязали MAX/не выбрали MAX как одного из провайдеров на сайте БАРС МЭИ!'))
            }
            return Promise.reject(CreateBARSError('LOGIN_FAIL', e.toString()))
          }
        })).then(result => {
          if (!this.IsCurrentStudentAccountAttempt(attempt)) {
            return 'CANCELLED'
          }
          const loginResult = result as LoginResult
          return loginResult === "NEED_2FA" ? this.HandleTwoFactorChallenge() : loginResult
        }).catch(e => {
          if (!this.IsCurrentStudentAccountAttempt(attempt)) {
            return Promise.resolve<LoginResult>('CANCELLED')
          }
          if (isIncorrectLoginPassword){
            return Promise.reject(CreateBARSError('INVALID_CREDS', 'Неверный логин/пароль!'))
          } else {
            console.warn("Data download time exceeded!", e)
            if (firstStart) {
              if (isBARSError(e)) {
                return Promise.reject(e);
              }
              return Promise.reject(CreateBARSError('LOGIN_FAIL', "Превышено время загрузки данных - проблемы с интернетом или на стороне БАРС! Проверьте качество сети и попробуйте снова позже. Если проблема сохраняется - сообщите разработчику(кнопка 'Поддержка')!"))
            }
            else return Promise.resolve<LoginResult>('OFFLINE')
          }
      })
    })
  }

  public LoadOfflineData(){
    console.log('Loading offline data...')
    const schedule = this.mStorage.getString(STORAGE_KEYS.SCHEDULE)
    const mail = this.mStorage.getString(STORAGE_KEYS.MAIL)
    const marks = this.mStorage.getString(STORAGE_KEYS.MARKS)
    const skippedClasses = this.mStorage.getString(STORAGE_KEYS.SKIPPED_CLASSES)
    const recordBook = this.mStorage.getString(STORAGE_KEYS.RECORD_BOOK)
    const tasks = this.mStorage.getString(STORAGE_KEYS.TASKS)
    const reports = this.mStorage.getString(STORAGE_KEYS.REPORTS)
    const stipends = this.mStorage.getString(STORAGE_KEYS.STIPENDS)
    const orders = this.mStorage.getString(STORAGE_KEYS.ORDERS)
    const books = this.mStorage.getString(STORAGE_KEYS.BOOKS)
    const questionnaires = this.mStorage.getString(STORAGE_KEYS.QUESTIONNAIRES)
    const student = this.mStorage.getString(STORAGE_KEYS.STUDENT_INFO)
    const addData = this.mStorage.getString(STORAGE_KEYS.ADDITIONAL_DATA)

    //console.warn(schedule,marks,skippedClasses,recordBook,student, reports)

    if(typeof student == 'undefined'){
      this.SetLoginState('NOT_LOGGED_IN')
      console.log('Student data not found. NOT_LOGGED_IN state emitted.')
      return
    } else {
      console.log('Parsing offline student info...')
      this.mCurrentData.student = JSON.parse(student)
      console.log(this.mCurrentData.student)
    }
    if (typeof schedule == 'undefined'){
      Store.dispatch(updateSchedule({status: "FAILED", data: typeof schedule != 'undefined' ? JSON.parse(schedule) : null}))
    } else {
      Store.dispatch(updateSchedule({status: "OFFLINE", data: typeof schedule != 'undefined' ? JSON.parse(schedule) : null}))
    }
    Store.dispatch(updateMarkTable({status: "OFFLINE", data: typeof marks != 'undefined' ? JSON.parse(marks) : null}))
    Store.dispatch(updateMail({status: "OFFLINE", data: typeof mail != 'undefined' ? JSON.parse(mail) : null}))
    Store.dispatch(updateSkippedClasses({status: "OFFLINE", data: typeof skippedClasses != 'undefined' ? JSON.parse(skippedClasses) : null}))
    Store.dispatch(updateRecordBook({status: "OFFLINE", data: typeof recordBook != 'undefined' ? JSON.parse(recordBook) : null}))
    Store.dispatch(updateReports({status: "OFFLINE", data: typeof reports != 'undefined' ? JSON.parse(reports) : null}))
    Store.dispatch(updateTasks({status: "OFFLINE", data: typeof tasks != 'undefined' ? JSON.parse(tasks) : null}))
    Store.dispatch(updateStipends({status: "OFFLINE", data: typeof stipends != 'undefined' ? JSON.parse(stipends) : null}))
    Store.dispatch(updateOrders({status: "OFFLINE", data: typeof orders != 'undefined' ? JSON.parse(orders) : null}))
    Store.dispatch(updateBooks({status: "OFFLINE", data: typeof books != 'undefined' ? JSON.parse(books) : null}))
    Store.dispatch(updateQuestionnaires({status: "OFFLINE", data: typeof questionnaires != 'undefined' ? JSON.parse(questionnaires) : null}))
    Store.dispatch(updateAdditionalData({status: "OFFLINE", data: typeof addData != 'undefined' ? JSON.parse(addData) : null}))
    console.log('All offline data dispatched.')
  }

  public get CurrentData(){
    return this.mCurrentData
  }

  public FetchRequestedSchedule(target: Teacher): Promise<BARSSchedule>{
    console.log('Trying to fetch requested schedule: ' + target.lec_oid)
    console.time('ScheduleRequest')
    const CheckInternet = () => {
      return NetInfo.fetch()
    }

    function classifyString(input: string): "person" | "group" | "auditorium" {
      if (!/\d/.test(input)) {
        return "person";
      }

      if (/\d{3}/.test(input)) {
        return "auditorium";
      }

      return "group";
    }

    const dateRange = CalculateRange()
    // const form = new FormData()
    let request_type = classifyString(target.lec_oid)
    // if (request_type == 'auditorium') {
      return CheckInternet().then((response)=> {
        if (!response.isConnected) {
          return Promise.reject(CreateBARSError('INVALID_REQUEST_SCHEDULE', 'Нет подключения к интернету!'))
        }
        else {
          try {
            let ts_mpei_link = 'http://ts.mpei.ru/api/search?term=' + encodeURI(target.lec_oid)  + '&type=' + request_type
            return fetch(ts_mpei_link, {
              method: 'GET',
              headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-encoding': 'gzip, deflate',
                'accept-language': 'ru,en;q=0.9',
                'dnt': '1',
                'host': 'ts.mpei.ru',
                'referer': 'http://ts.mpei.ru/ruz/main',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 YaBrowser/25.8.0.0 Safari/537.36'
              },
              credentials: 'include'
            }).then(r => r.json()).then(r => {
                const dateStart = moment(new Date()).format('YYYY.MM.DD')
                const dateEnd = moment(dateRange[1], 'DD.MM.YYYY')
                const linkTargetSchedule = `http://ts.mpei.ru/api/schedule/${request_type}/${r[0]?.id || ''}?start=${dateStart}&finish=${dateEnd.format('YYYY.MM.DD')}&lng=1`
                return fetch(linkTargetSchedule, {
                  method: 'GET',
                  headers: {},
                  credentials: 'include'
                }).then(r=>r.json()).then(r=> {
                  let scheduleWithDinner = DealWithMeal(ParseTsMPEISchedule(r))
                  switch (request_type) {
                    case 'person':
                      scheduleWithDinner.fullTeacherName = (r[0]?.lecturer || r[1]?.lecturer) ? (r[0]?.listOfLecturers[0].lecturer_title || r[1]?.listOfLecturers[0].lecturer_title || target.lec_oid) : "Запрошенный преподаватель не найден"
                      break
                    case "group":
                      scheduleWithDinner.fullTeacherName = r[0]?.group || r[1]?.group || r[2]?.group || r[5]?.group || r[8]?.group || target.lec_oid || "Запрошенная группа не найдена"
                      break
                    case "auditorium":
                      scheduleWithDinner.fullTeacherName = r[0]?.auditorium || r[1]?.auditorium  || target.lec_oid || "Запрошенная аудитория не найдена"
                      break
                  }
                  console.timeEnd('ScheduleRequest')
                  return scheduleWithDinner
                })
              })
            } catch (error) {
              throw CreateBARSError("INVALID_REQUEST_SCHEDULE", "По указанным данным ни группа, ни преподаватель, ни аудитория не обнаружены! Скорректируйте ввод и попробуйте ещё раз.");
            }
        }
      })
    /*} else {
      let normal_name = ''
      form.append('search', target.lec_oid)
      // end.addDays(APP_CONFIG.DATE_RANGE)

      return CheckInternet().then((response)=> {
        if (!response.isConnected)
          return Promise.reject(CreateBARSError('INVALID_REQUEST_SCHEDULE', 'Нет подключения к интернету!'))
        else {
        //TODO У oss.mpei.ru почему-то больше нет расписания - подобрать другой альтернативный источник расписания!
         return fetch('https://oss.mpei.ru/api/schedule/search', {
            method: 'POST',
            headers: {
              'Accept': 'application/josn',
              'Content-Type': 'multipart/form-data'
            },
            body: form
          }).then(r => r.json()).then(r => {
            const fform = new FormData()
            try {
              fform.append('oid', r.groups[0].groupOid);
              request_type = 'group'
              normal_name = r.groups[0].name
            } catch (e) {
              try {
                fform.append('oid', r.teachers[0].lecturerOid);
                request_type = 'teacher'
                normal_name = r.teachers[0].fio
              } catch (error) {
                throw CreateBARSError("INVALID_REQUEST_SCHEDULE", "По указанным данным ни группа, ни преподаватель, ни аудитория не обнаружены! Скорректируйте ввод и попробуйте ещё раз.");
              }
            }
            fform.append('type', request_type);
            fform.append('fromDate', moment(new Date()).format('YYYY.MM.DD'))
            fform.append('toDate', moment(dateRange[1]).format('YYYY.MM.DD'))
            if (request_type == 'teacher') {
              if (r.teachers.length == 0)
                throw 'Error'
            } else if (r.groups.length == 0)
              throw 'Error'
            return fetch('https://oss.mpei.ru/api/schedule', {
              headers: {
                'Accept': 'application/josn',
                'Content-Type': 'multipart/form-data'
              },
              method: 'POST',
              body: fform
            }).then(d => d.json()).then(data => {
              const res: BARSSchedule = {
                todayIndex: 0,
                fullTeacherName: normal_name,
                days: []
              }
              let f = true
              //console.log(data);

              for (const [date, lessons] of Object.entries(data)) {
                //console.log('LL', [date, lessons]);
                const ll = (lessons as any[]).map((lesson, k) => {
                  return {
                    name: lesson.discipline,
                    lessonIndex: lesson.beginLesson + '-' + lesson.endLesson,
                    lessonType: lesson.kindOfWork,
                    place: lesson.place,
                    cabinet: lesson?.auditorium || '',
                    teacher: { name: lesson.lecturer, lec_oid: lesson.lecturerOid },
                    group: lesson.group,
                    type: 'COMMON'
                  } as BARSScheduleLesson
                }) ?? []
                const cell: BARSScheduleCell = {
                  date: date.split('.').reverse().join('.'),
                  lessons: ll,
                  isToday: f,
                  isEmpty: (lessons as any[]).length === 0
                }
                f = false
                res.days.push(cell)
                //console.log('CELL',cell);

              }
              console.timeEnd('ScheduleRequest')
              return DealWithMeal(DealWithRepeated(res))
            })
          })
        }
      })
    }*/
  }

  public async FetchSchedule(): Promise<void>{
    console.log('Fetching schedule')
    console.time('ScheduleParser')
    const generation = this.mSessionGeneration
    const student = this.mCurrentData.student
    if (!student) {
      Store.dispatch(updateSchedule({status: 'FAILED', data: null}))
      throw CreateBARSError('SCHEDULE_PARSER_FAIL', 'Не найдены данные студента для загрузки расписания.')
    }

    const group = student.group.includes('не распарсилось') ? 'ЭР-11-21' : student.group
    const dateRange = CalculateRange()
    const dateStart = moment(dateRange[0], 'DD.MM.YYYY')
    const dateEnd = moment(dateRange[1], 'DD.MM.YYYY')
    const linkSearch = `http://ts.mpei.ru/api/search?term=${encodeURI(group)}&type=group`

    try {
      const schedule = await Timeout(15000, fetch(linkSearch, {
        method: 'GET',
        headers: {},
        credentials: 'include',
      }).then(response => response.json()).then(result => {
        if (!result?.length) {
          throw CreateBARSError('SCHEDULE_PARSER_FAIL', 'Группа не найдена на сервере расписания!')
        }
        const link = `http://ts.mpei.ru/api/schedule/group/${result[0]?.id || ''}?start=${dateStart.format('YYYY.MM.DD')}&finish=${dateEnd.format('YYYY.MM.DD')}&lng=1`
        return fetch(link, {
          method: 'GET',
          headers: {},
          credentials: 'include',
        }).then(response => response.json()).then(data => DealWithMeal(ParseTsMPEISchedule(data)))
      }))
      if (!this.IsCurrentGeneration(generation)) {
        return
      }

      console.timeEnd('ScheduleParser')
      const currentMonth = parseInt(moment().format('M'))
      const isVacationPeriod = currentMonth === 1 || currentMonth === 2 || (currentMonth > 5 && currentMonth < 9)
      if (schedule.days.length === 0 && !isVacationPeriod) {
        throw CreateBARSError('SCHEDULE_PARSER_FAIL', 'Расписание пока не опубликовано.')
      }
      this.mStorage.set(STORAGE_KEYS.SCHEDULE, JSON.stringify(schedule))
      Store.dispatch(updateSchedule({status: 'LOADED', data: schedule}))
    } catch (error) {
      if (!this.IsCurrentGeneration(generation)) {
        return
      }
      console.warn('Failed to fetch schedule; trying offline data', error)
      const cached = this.mStorage.getString(STORAGE_KEYS.SCHEDULE)
      if (cached) {
        try {
          Store.dispatch(updateSchedule({status: 'OFFLINE', data: JSON.parse(cached)}))
          return
        } catch (cachedError) {
          console.warn('Saved schedule is invalid', cachedError)
        }
      }
      Store.dispatch(updateSchedule({status: 'FAILED', data: null}))
      throw error
    }
  }


  public async FetchRecordBook(): Promise<void>{
    console.log('Fetching record book')
    const generation = this.mSessionGeneration
    const student = this.mCurrentData.student
    if (!student) {
      Store.dispatch(updateRecordBook({status: 'FAILED', data: null}))
      throw CreateBARSError('RECORDS_PARSER_FAIL', 'Не найдены данные студента для загрузки зачётной книжки.')
    }

    try {
      const response = await Timeout(5500, fetch(URLS.BARS_RECORD_BOOK + student.id, {
        method: 'GET',
        headers: HEADER_WITH_USER_ID(student.id),
        mode: 'same-origin',
        credentials: 'include',
      }).then(result => result.text()))
      const pager = parse(response).querySelector('#recordBook__Pager')
      if (!pager) {
        throw CreateBARSError('RECORDS_PARSER_FAIL', 'Не удалось получить список семестров зачётной книжки.')
      }

      let semesterIndex = 0
      const semesterPages = await Promise.all(
        pager.querySelectorAll('li').flatMap(item => {
          const link = item.querySelector('a')
          if (!link?.text.trim().includes('семестр')) {
            return []
          }
          semesterIndex += 1
          const semesterLink = `https://bars.mpei.ru/bars_web/ST_LK/RecordBook/ListStudent__RecordBook?studentID=${student.id}&query=%7B%22ID%22%3A%22${student.id}%22%2C%22SortOrder%22%3Anull%2C%22Page%22%3Anull%2C%22DisplayMode%22%3A%22%22%2C%22FilterRecordBookPage%22%3A%7B%22Code%22%3A%22sem%3A${semesterIndex}%22%7D%7D`
          return [fetch(semesterLink, {
            method: 'GET',
            headers: HEADER_WITH_USER_ID(student.id),
            mode: 'same-origin',
            credentials: 'include',
          }).then(result => result.text())]
        }),
      )
      const recordBook = RecordBookParser(semesterPages)
      if (isBARSError(recordBook)) {
        throw recordBook
      }
      if (!this.IsCurrentGeneration(generation)) {
        return
      }
      this.mStorage.set(STORAGE_KEYS.RECORD_BOOK, JSON.stringify(recordBook))
      Store.dispatch(updateRecordBook({status: 'LOADED', data: recordBook}))
    } catch (error) {
      if (!this.IsCurrentGeneration(generation)) {
        return
      }
      console.warn('Failed to fetch record book; trying offline data', error)
      const cached = this.mStorage.getString(STORAGE_KEYS.RECORD_BOOK)
      if (cached) {
        try {
          Store.dispatch(updateRecordBook({status: 'OFFLINE', data: JSON.parse(cached)}))
          return
        } catch (cachedError) {
          console.warn('Saved record book is invalid', cachedError)
        }
      }
      Store.dispatch(updateRecordBook({status: 'FAILED', data: null}))
      throw error
    }
  }

  public FetchSkippedClasses(): Promise<void>{
    console.log('Fetching skipped classes')
    const student = this.mCurrentData.student
    const semester = this.mCurrentData.availableSemesters?.[0]
    if (!student || !semester) {
      Store.dispatch(updateSkippedClasses({status: 'FAILED', data: null}))
      return Promise.reject(CreateBARSError('SKIPPED_CLASSES_PARSER_FAIL', 'Не найдены данные студента для загрузки пропусков.'))
    }
    const link = encodeURI(
      URLS.BARS_SKIPPED_CLASSES + student.id + '&query=' + JSON.stringify({
        ID: student.id,
        Page: '1',
        PageSize: '500',
        FilterSemester: {value: semester.id},
      }),
    )
    return this.FetchCachedDataSection({
      section: 'skippedClasses',
      storageKey: STORAGE_KEYS.SKIPPED_CLASSES,
      timeoutMs: 4000,
      request: () => fetch(link, {
        method: 'GET',
        headers: HEADER_WITH_USER_ID(student.id),
        mode: 'same-origin',
        credentials: 'include',
      }).then(response => response.text()),
      parse: SkippedClassesParser,
      update: state => Store.dispatch(updateSkippedClasses(state)),
    })
  }

  public FetchReports(): Promise<void>{
    console.log('Fetching reports')
    const student = this.mCurrentData.student
    if (!student) {
      Store.dispatch(updateReports({status: 'FAILED', data: null}))
      return Promise.reject(CreateBARSError('REPORTS_PARSER_FAIL', 'Не найдены данные студента для загрузки отчётов.'))
    }
    return this.FetchCachedDataSection({
      section: 'reports',
      storageKey: STORAGE_KEYS.REPORTS,
      timeoutMs: 1750,
      request: () => fetch(URLS.BARS_REPORTS + student.id, {
        method: 'GET',
        headers: HEADER_WITH_USER_ID(student.id),
        mode: 'same-origin',
        credentials: 'include',
      }).then(response => response.text()),
      parse: ReportsParser,
      update: state => Store.dispatch(updateReports(state)),
    })
  }

  public FetchTasks(): Promise<void>{
    console.log('Fetching tasks')
    const student = this.mCurrentData.student
    if (!student) {
      Store.dispatch(updateTasks({status: 'FAILED', data: null}))
      return Promise.reject(CreateBARSError('TASKS_PARSER_FAIL', 'Не найдены данные студента для загрузки заданий.'))
    }
    return this.FetchCachedDataSection({
      section: 'tasks',
      storageKey: STORAGE_KEYS.TASKS,
      timeoutMs: 2000,
      request: () => fetch(URLS.BARS_TASKS + student.id, {
        method: 'GET',
        headers: HEADER_WITH_USER_ID(student.id),
        mode: 'same-origin',
        credentials: 'include',
      }).then(response => response.text()),
      parse: TasksParser,
      update: state => Store.dispatch(updateTasks(state)),
    })
  }

  public FetchBooks(): Promise<void>{
    console.log('Fetching books')
    const student = this.mCurrentData.student
    if (!student) {
      Store.dispatch(updateBooks({status: 'FAILED', data: null}))
      return Promise.reject(CreateBARSError('BOOKS_PARSER_FAIL', 'Не найдены данные студента для загрузки книг.'))
    }
    return this.FetchCachedDataSection({
      section: 'books',
      storageKey: STORAGE_KEYS.BOOKS,
      timeoutMs: 2000,
      request: () => fetch(URLS.BARS_BOOKS + student.id, {
        method: 'GET',
        headers: HEADER_WITH_USER_ID(student.id),
        mode: 'same-origin',
        credentials: 'include',
      }).then(response => response.text()),
      parse: BooksParser,
      update: state => Store.dispatch(updateBooks(state)),
    })
  }

  public async FetchMail(): Promise<void> {
    console.log('Fetching legacy mail');
    const generation = this.mSessionGeneration
    try {
    const { login, password } = this.GetCreds();
    let redirectUrl: string | null
    let mode: 'legacy' | 'modern' = 'legacy'

    const loginUrl = `${URLS.MAIL_LEGACY}/CookieAuth.dll?Logon`;
    const refererCurl = 'Z2FowaZ2FZ3FaeZ3DFolderZ26tZ3DIPF.Note&reason=0&formdir=2';

    // Формируем тело как application/x-www-form-urlencoded
    const GetForm = (curl: string)  => {
      return new URLSearchParams({
        curl: curl,
        flags: '0',
        forcedownlevel: '0',
        formdir: '2',
        username: login,
        password: password,
        isUtf8: '1',
        trusted: '4'
      })
    }

    // Первый fetch с redirect: 'manual', credentials: 'include'
    const resp1 = await fetch(loginUrl, {
      method:   'POST',
      mode:     'same-origin',
      credentials: 'include',
      // @ts-expect-error
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'Accept':       'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Origin':       URLS.MAIL_LEGACY,
        'Referer':      `${URLS.MAIL_LEGACY}/CookieAuth.dll?GetLogon?curl=${refererCurl}`
      },
      body: GetForm('Z2FowaZ2FZ3FaeZ3DFolderZ26tZ3DIPF.NoteZ26idZ3DLgAAAAAZ252faJ6Rlp8wQ4mSsQM3EPEvAQA3zcW5sZ252fzhSry5ktzNFKjqAHEtjletAAABZ26slUsngZ3D0').toString()
    });

    let html = ''
    if (resp1.status == 200) {
      html = await resp1.text()
      if (html.includes('mail.mpei.ru')){
        mode = 'modern'
      }
    }
    if ((resp1.status !== 200) && (resp1.status !== 302)) {
        const text = await resp1.text()
        console.error('Legacy mail login failed, server returned:', resp1.status, text)
        throw new Error('Legacy mail login failed')
    }
    if ((mode == 'legacy' && (resp1.status === 302))) {
      redirectUrl = resp1.headers.get('Location')
      if (!redirectUrl) {
        throw new Error('No redirect URL after legacy mail login')
      }
      console.log('Redirecting to ', redirectUrl)
      // Второй fetch по полученному URL: браузер автоматически приклеит HTTP-Only cookie
      const resp2 = await fetch(redirectUrl, {
        method: 'GET',
        mode: 'same-origin',
        credentials: 'include'
      });

      if (!resp2.ok) {
        console.error('Failed to load mailbox page:', resp2.status)
        throw new Error('Mailbox fetch failed')
      }
      html = await resp2.text()
      console.log('resp2 html received')
    } else if (mode == 'modern') {
      const url_3 = URLS.MAIL_MODERN + '/CookieAuth.dll?Logon'
      const resp3 = await fetch(url_3, {
            method:   'POST',
            mode:     'same-origin',
            credentials: 'include',
            // @ts-expect-error
            redirect: 'manual',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'Accept':       'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Origin':       URLS.MAIL_MODERN,
              'Referer':      `${URLS.MAIL_MODERN}/CookieAuth.dll?GetLogon?curl=Z2Fowa&reason=0&formdir=2`
            },
            body: GetForm('Z2Fowa').toString()
          });
      html = await resp3.text()
      // console.log('resp3 html received')
      if ((html.includes('ASP.auth_error')) || (resp3.status === 302)) {
        try {
          redirectUrl = resp3.headers.get('Location') + ''
          console.log('Redirecting to ' + redirectUrl)
          const resp4 = await fetch(redirectUrl, {
            method:      'GET',
            mode:        'same-origin',
            credentials: 'include'
          });
          if (resp4.status == 200) {
            html = await resp4.text()
            // console.log('resp4 html received')
          } else {
            if (resp4.status !== 301) {
              const text = await resp4.text()
              console.error('Modern mail login failed, server returned:', resp4.status, text)
            }
            const final_url = URLS.MAIL_MODERN + '/owa/'
            console.log('Fetching '+ final_url)
            const resp5 = await fetch(final_url, {
              method:      'GET',
              mode:        'same-origin',
              credentials: 'include'
            });
            if (resp5.status == 200) {
              html = await resp5.text()
              // console.log('resp5 html received')
            } else {
              const text = await resp5.text()
              console.error('Modern mail login failed on final url, server returned:', resp5.status, text)
            }
          }
        } catch (e: any) {
          console.error('Modern mail redirects failed: ' + e.toString())
        }
      }
    }
    // парсим почту
    const mail = MailParser(html, mode)
    if (isBARSError(mail)) {
      console.warn('Failed to parse mail!', mail);
      throw mail
    }
    if (!this.IsCurrentGeneration(generation)) {
      return
    }
    Store.dispatch(updateMail({ status: 'LOADED', data: mail }));
    this.mStorage.set(STORAGE_KEYS.MAIL, JSON.stringify(mail));
    this.mCurrentData.mail = mail
    console.log('Unread e-mails: ' + mail.unreadCount);
    } catch (error) {
      if (!this.IsCurrentGeneration(generation)) {
        return
      }
      console.warn('Failed to check mail', error)
      const unavailableMail: OWAMail = {
        mode: 'error',
        unreadCount: 'не удалось обновить',
      }
      Store.dispatch(updateMail({status: 'OFFLINE', data: unavailableMail}))
      throw error
    }
  }


  public FetchQuestionnaires(): Promise<void>{
    console.log('Fetching questionnaires')
    const student = this.mCurrentData.student
    if (!student) {
      Store.dispatch(updateQuestionnaires({status: 'FAILED', data: null}))
      return Promise.reject(CreateBARSError('QUESTIONNAIRES_PARSER_FAIL', 'Не найдены данные студента для загрузки анкет.'))
    }
    const link = URLS.BARS_QUESTIONNAIRES + this.mCredentials.login
      + '&query=%7B"ID"%3Anull%2C"State"%3Anull%2C"SortOrder"%3A"EditEndDate%20desc%2CQuestionnaire.Name"%2C"Page"%3A"1"%2C"PageSize"%3A"500"%7D'
    return this.FetchCachedDataSection({
      section: 'questionnaires',
      storageKey: STORAGE_KEYS.QUESTIONNAIRES,
      timeoutMs: 3000,
      request: () => fetch(link, {
        method: 'GET',
        headers: HEADER_WITH_USER_ID(student.id),
        mode: 'same-origin',
        credentials: 'include',
      }).then(response => response.text()),
      parse: QuestionnairesParser,
      update: state => Store.dispatch(updateQuestionnaires(state)),
    })
  }

  public FetchStipends(): Promise<void>{
    console.log('Fetching stipends')
    const student = this.mCurrentData.student
    if (!student) {
      Store.dispatch(updateStipends({status: 'FAILED', data: null}))
      return Promise.reject(CreateBARSError('STIPENDS_PARSER_FAIL', 'Не найдены данные студента для загрузки стипендий.'))
    }
    return this.FetchCachedDataSection({
      section: 'stipends',
      storageKey: STORAGE_KEYS.STIPENDS,
      timeoutMs: 3000,
      request: () => fetch(URLS.BARS_STIPENDS + student.id, {
        method: 'GET',
        headers: HEADER_WITH_USER_ID(student.id),
        mode: 'same-origin',
        credentials: 'include',
      }).then(response => response.text()),
      parse: StipendsParser,
      update: state => Store.dispatch(updateStipends(state)),
    })
  }

  public FetchOrders(): Promise<void>{
    console.log('Fetching orders')
    const student = this.mCurrentData.student
    if (!student) {
      Store.dispatch(updateOrders({status: 'FAILED', data: null}))
      return Promise.reject(CreateBARSError('ORDERS_PARSER_FAIL', 'Не найдены данные студента для загрузки приказов.'))
    }
    return this.FetchCachedDataSection({
      section: 'orders',
      storageKey: STORAGE_KEYS.ORDERS,
      timeoutMs: 2250,
      request: () => fetch(URLS.BARS_ORDERS + student.id, {
        method: 'GET',
        headers: HEADER_WITH_USER_ID(student.id),
        mode: 'same-origin',
        credentials: 'include',
      }).then(response => response.text()),
      parse: OrdersParser,
      update: state => Store.dispatch(updateOrders(state)),
    })
  }

  public async FetchMarkTable(semesterID?: string, forPast: boolean = false): Promise<void | BARSMarks>{
    console.log('Fetching mark table...')
    const generation = this.mSessionGeneration
    const student = this.mCurrentData.student
    if (!student) {
      if (!forPast) {
        Store.dispatch(updateMarkTable({status: 'FAILED', data: null}))
      }
      throw CreateBARSError('MARK_TABLE_PARSER_FAIL', 'Не найдены данные студента для загрузки оценок.')
    }

    let link = URLS.BARS_MAIN + 'ST_Study/Main/Main?studentID=' + student.id
    if (semesterID !== undefined) {
      link += '&query=' + JSON.stringify({
        ID: student.id,
        FilterSemester: {value: semesterID},
      })
    }

    try {
      const response = await Timeout(15000, fetch(encodeURI(link), {
        method: 'GET',
        headers: COMMON_HTTP_HEADER,
        mode: 'same-origin',
        credentials: 'include',
      }).then(result => result.text()))
      const marks = ParsMarkTable(response)
      if (isBARSError(marks)) {
        throw marks
      }
      if (!this.IsCurrentGeneration(generation)) {
        return
      }
      if (forPast) {
        return marks
      }

      Store.dispatch(updateMarkTable({status: 'LOADED', data: marks}))
      this.mStorage.set(STORAGE_KEYS.MARKS, JSON.stringify(marks))
      if (this.mBackgroundMode) {
        this.mCurrentData.marks = marks
      }
      console.log('Fetched mark table', forPast)
    } catch (error) {
      if (!this.IsCurrentGeneration(generation)) {
        return
      }
      if (forPast) {
        throw isBARSError(error) ? error : CreateBARSError('MARK_TABLE_PARSER_FAIL', String(error))
      }

      console.warn('Failed to fetch mark table; trying offline data', error)
      const cached = this.mStorage.getString(STORAGE_KEYS.MARKS)
      if (cached) {
        try {
          Store.dispatch(updateMarkTable({status: 'OFFLINE', data: JSON.parse(cached)}))
          return
        } catch (cachedError) {
          console.warn('Saved marks are invalid', cachedError)
        }
      }
      Store.dispatch(updateMarkTable({status: 'FAILED', data: null}))
      throw isBARSError(error) ? error : CreateBARSError('MARK_TABLE_PARSER_FAIL', String(error))
    }
  }
}
