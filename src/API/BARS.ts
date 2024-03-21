import {
  BARSCredentials,
  BARSData,
  BARSDiscipline,
  BARSMarks,
  BARSSchedule,
  BARSScheduleCell,
  BARSScheduleLesson,
  BARSStudentInfo,
  Semester,
  Teacher,
} from "./DataTypes";
import { COMMON_HTTP_HEADER, STORAGE_KEYS, URLS } from "../Common/Constants";
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
import { MMKV } from "react-native-mmkv";
import { Store } from "./Redux/Store";
import {
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
// @ts-ignore
import { changeIcon, getIcon } from "react-native-change-icon";
import NetInfo from "@react-native-community/netinfo";
import moment from "moment/moment";
import QuestionnairesParser from "./Parsers/QuestionnairesParser";
import TasksParser from "./Parsers/TasksParser";
import StipendsParser from "./Parsers/StipendsParser";
import OrdersParser from "./Parsers/OrdersParser";

export type LoginState = 'LOGGED_IN' | 'NOT_LOGGED_IN' | 'NOT_INITIATED'

function Timeout(ms:number, promise:Promise<any>): Promise<"ONLINE" | "OFFLINE" | void | BARSMarks> {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      reject(new Error("timeout"))
    }, ms);
    promise.then(resolve, reject)
  })
}

const DealWithMeal = (schedule: BARSSchedule) : BARSSchedule => {
  for(let i = 0; i < schedule.days.length; i++){
    for(let j = 0; j < schedule.days[i].lessons.length; j++){
      if(schedule.days[i].lessons[j].lessonIndex == '11:10-12:45'){
        try {
          if (schedule.days[i].lessons[j + 1].lessonIndex == '11:10-12:45') {
            //@ts-ignore
            schedule.days[i].lessons.splice(j + 2, 0, { type: 'DINNER' })
          } else {
            //@ts-ignore
            schedule.days[i].lessons.splice(j + 1, 0, { type: 'DINNER' })
          }
        } catch (e) {
          //@ts-ignore
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

const DealWithRepeated = (schedule: BARSSchedule) : BARSSchedule => {
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
  private mCredentials: BARSCredentials = {login: '', password: ''}
  public mStorage = new MMKV()
  private mCurrentIcon: 'cool' | 'dragons' | 'simple' | 'matterial' | 'gold' = 'cool'
  public mCurrentWeek = ''
  private mDebts: BARSDiscipline[] = []

  public get Debts() { return this.mDebts }

  constructor() {
    //this.mStorage.clearAll()
    this.mCurrentData = {}
    getIcon().then((r: 'cool' | 'dragons' | 'simple' | 'matterial' | 'gold' = 'cool')=>{
      this.mCurrentIcon=r
    })
  }
  public get Week(){return this.mCurrentWeek}
  public ChangeIcon(name: 'cool' | 'dragons' | 'simple' | 'matterial' | 'gold'){
    changeIcon(name).then(()=>{
      return getIcon().then((i: 'cool' | 'dragons' | 'simple' | 'matterial' | 'gold' = 'cool')=>{
        this.mCurrentIcon = i
        console.log('Icon changed to ' + i)
      })
    })
  }
  public get Icon(){return this.mCurrentIcon}

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
      // @ts-ignore
      return this.Login(this.mCredentials, false).then((mode: 'ONLINE' | 'OFFLINE')=> {
        //if(backgroundMode) return this.FetchMarkTable().then(()=>Promise.resolve(true))
        if(mode == 'ONLINE'){
          return this.LoadOnlineData().finally(()=>{
            LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
            DeviceEventEmitter.emit('LoginState', 'LOGGED_IN')
          })
        } else if (mode == 'OFFLINE'){
          this.LoadOfflineData()
          //LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
          setTimeout(()=>DeviceEventEmitter.emit('LoginState', 'LOGGED_IN'), 500)
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
          DeviceEventEmitter.emit('LoginState', 'NOT_LOGGED_IN' as LoginState)
        }
        return Promise.resolve(false);
      })
    } else {
      console.log('Credentials not found');
      this.mCredentials = {login: '', password: ''}
      if(!backgroundMode){
        setTimeout(()=>{
          DeviceEventEmitter.emit('LoginState', 'NOT_LOGGED_IN' as LoginState)
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

  public ClearStorage(){
    for(const k of this.mStorage.getAllKeys()){
      this.mStorage.delete(k)
    }
    this.mStorage.clearAll()
    //for(let i of Object.entries(STORAGE_KEYS)){
    //  this.mStorage.delete(i[1])
    //  console.log(this.mStorage.getString(i[1]))
    //}
    Store.dispatch(updateSchedule({status: "LOADING", data: null}))
    Store.dispatch(updateSkippedClasses({status: "LOADING", data: null}))
    Store.dispatch(updateRecordBook({status: "LOADING", data: null}))
    Store.dispatch(updateTasks({status: "LOADING", data: null}))
    Store.dispatch(updateReports({status: "LOADING", data: null}))
    Store.dispatch(updateStipends({status: "LOADING", data: null}))
    Store.dispatch(updateOrders({status: "LOADING", data: null}))
    Store.dispatch(updateQuestionnaires({status: "LOADING", data: null}))
    Store.dispatch(updateMarkTable({status: "LOADING", data: null}))
    DeviceEventEmitter.emit('LoginState', 'NOT_LOGGED_IN')
    this.mCurrentData = {}
    this.mTestMode = false
  }

  private FetchCurrentWeek(){
    console.time('CurrentWeek ' + Platform.OS)
    return Timeout(1500, fetch('https://mpei.ru/Education/timetable/Pages/default.aspx',{method: 'GET', headers: COMMON_HTTP_HEADER}).then(r=>r.text()).then((r)=>{
      try{
        this.mCurrentWeek = parse(r).querySelector('#ctl00_g_06da9461_ac13_4827_a73a_ec9ca4dd6498 > div > div')!.text
        console.timeEnd('CurrentWeek ' + Platform.OS)
      } catch (e: any){
        this.mCurrentWeek = '?'
        console.warn("Failed to get current week")
        console.timeEnd('CurrentWeek ' + Platform.OS)
      } finally {
        return Promise.resolve();
      }
    })).catch(e => {
      this.mCurrentWeek = '?'
      console.warn("Data download time exceeded on current week!", e)
    })
  }

  public LoadOnlineData(): Promise<void | BARSMarks | "ONLINE" | "OFFLINE">{
    if (APP_CONFIG.TEST_MODE && Compare(APP_CONFIG.TEST_CREDS, this.mCredentials)) {
      this.mCurrentData = TEST_DATA
      return Promise.resolve();
    }

    return this.FetchCurrentWeek().finally(
            () => this.FetchMarkTable().finally(()=>{

              const Con = () => this.FetchSchedule().finally(
                  () => {
                    DeviceEventEmitter.emit('LoginState', 'LOGGED_IN')
                    console.log('Main fetch complete')
                    return this.FetchSkippedClasses().finally(
                        () => this.FilterAvailableSemesters(this.mCurrentData.availableSemesters!).finally(
                            () => this.FetchRecordBook().finally(
                              () => this.FetchTasks().finally(
                                () => this.FetchReports().finally(
                                  () => this.FetchStipends().finally(
                                    () => this.FetchOrders().finally(
                                      () => this.FetchQuestionnaires().finally(
                                        () => console.log('Extra fetch complete')
                                ))))))))
                  })

              //Долги
              const l = this.mCurrentData.availableSemesters?.length;
              if(typeof l != 'undefined' && l > 1){
                return this.FetchMarkTable(this.mCurrentData.availableSemesters![1].id, true).then((result)=>{
                  const res = result as BARSMarks //Couldn't be void anyway
                  const debts: BARSDiscipline[] = []
                  for(let discipline of res.disciplines) {
                    const mark = discipline.resultMarks[discipline.resultMarks.length - 1].mark;
                    if (new RegExp(/[0-2]/gm).test(mark)) {
                      discipline.debt = true
                      debts.push(discipline);
                      console.log('Pushed debt', discipline.name, mark)
                    }
                  }
                  this.mDebts = debts
                }).catch(()=>{
                }).finally(Con)
              } else {
                return Con();
              }

            }))
        .catch(() => {
          const current_month = parseInt(moment().format("M"))
          if ((current_month > 2 && current_month < 6) ?? ( current_month > 8)) {
            Alert.alert("Внимание!", "Во время получения данных возникли " +
                "проблемы! Возможно отсутствие некоторой информации! Рекомендуем сообщить разработчикам об этом.")
          }
          return Promise.resolve();
        })
  }

  public FilterAvailableSemesters(sems: Semester[]):Promise<void>{
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
      return fetch(link, {method: 'GET', headers: COMMON_HTTP_HEADER}).then((r=>r.text())).then((response)=>{
        try {
          const $ = parse(response).querySelectorAll('.hr-separator')!

          return {sem, available: $.length - 4 != 0 }
        } catch (e: any){
          throw CreateBARSError('SEMESTER_FILTER_FAIL', e)
        }
      })
    }
    const promises: Promise<{sem: Semester, available: boolean}>[] = []
    try{
      for(let i of sems){
        promises.push(check(i))
      }
      return Promise.all(promises).then((res)=>{
        const result: Semester[] = []
        for(let i of res){
          if(i.available){
            result.push(i.sem)
          }
        }
        this.mCurrentData.availableSemesters = result
        DeviceEventEmitter.emit('refresh_semSelector')
      })
    } catch (e: any){
      //console.warn(e);
      //if(isBARSError(e)) return Promise.reject(e)
      //else return Promise.reject(CreateBARSError('SEMESTER_FILTER_FAIL', e.toString()))
    } finally {
      return Promise.resolve()
    }
  }
  public get TestMode(){return this.mTestMode}

  public Login(creds: BARSCredentials, firstStart: boolean = true): Promise<"ONLINE" | "OFFLINE" | void | BARSMarks>{
    let isIncorrectLoginPassword = false
    if(APP_CONFIG.TEST_MODE && Compare(APP_CONFIG.TEST_CREDS, creds)){
      Alert.alert('Info', 'Entered test mode.')
      this.mCredentials = creds
      this.mCurrentData = require('../Common/TestData.json')
      this.mTestMode = true
      console.log('Dispatching test data...')
      Store.dispatch(updateSchedule({status: "LOADED", data: this.mCurrentData.schedule!}))
      Store.dispatch(updateSkippedClasses({status: "LOADED", data: this.mCurrentData.skippedClasses!}))
      Store.dispatch(updateRecordBook({status: "LOADED", data: this.mCurrentData.records!}))
      Store.dispatch(updateReports({status: "LOADED", data: this.mCurrentData.reports!}))
      Store.dispatch(updateMarkTable({status: "LOADED", data: this.mCurrentData.marks!}))
      DeviceEventEmitter.emit('LoginState', 'LOGGED_IN')
      console.log('Dispatched test data.')
      return Promise.resolve('ONLINE')
    }

    const CheckInternet = () => {
      return NetInfo.fetch()
    }

    return CheckInternet().then((response)=> {
      if (!(response.isConnected) && firstStart)
        return Promise.reject(CreateBARSError('LOGIN_FAIL', 'Нет подключения к интернету!'))
      else if (!(response.isConnected)) {
        return Promise.resolve<'ONLINE' | 'OFFLINE' | BARSMarks | void>('OFFLINE')
      }
      console.time('Login&StudentInfoParser')
      return Timeout(4000, fetch(URLS.BARS_MAIN, {
        method: 'POST',
        headers: {
          'User-Agent': 'iPhone',
          'Accept-Encoding': 'gzip, deflate', 'Accept': '*/*',
          'Content-Type': 'application/json',
          'Referer': URLS.BARS_MAIN
        },
        body: JSON.stringify({
          UserName: creds.login,
          Password: creds.password,
          Remember: false
        })
      }).then(async (response) => {
        let str = await response.text()
        if (str.includes("sod=1")) {
          console.warn("User + sod=1 variant login!")
          return fetch('https://bars.mpei.ru/bars_web/?sod=1', {
            method: "GET",
            headers: COMMON_HTTP_HEADER,
          })
        } else return fetch(URLS.BARS_MAIN, {
          method: 'POST',
          headers: {
            'User-Agent': 'iPhone',
            'Accept-Encoding': 'gzip, deflate', 'Accept': '*/*',
            'Content-Type': 'application/json',
            'Referer': URLS.BARS_MAIN
          },
          body: JSON.stringify({
            UserName: creds.login,
            Password: creds.password,
            Remember: false
          })
        })
      })
        .then(r => r.text())
        .then((response) => {
          // throw "ters";
          this.mCurrentData = {}
          if (response.includes("Студенты")) { //mul acc
            const isHeadman = response.includes("Студенты") && response.includes("Отчёты");
            return fetch(URLS.BARS_MULTI_ACCOUNT, {
              method: "GET",
              headers: COMMON_HTTP_HEADER,
            }).then(r => r.text()).then((response) => {
              const $ = cheerio.load(response);
              const last = $("#tbl__PartialListStudent > tbody").find("tr").length;
              let target_acc = last
              let acc_status = $(`#tbl__PartialListStudent > tbody > tr:nth-child(${last}) > td:nth-child(5)`)[0].children[0].data
              if (acc_status.includes('отчислен')){
                console.log('The status is "Expelled" in the last account! An attempt to find a valid one...')
                for (let i = (last - 1); i >= 1; i--) {
                  let textForCheck = $(`#tbl__PartialListStudent > tbody > tr:nth-child(${i}) > td:nth-child(5)`)[0].children[0].data
                  if (!textForCheck.includes("отчислен")) {
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
              }).then(r => r.text()).then((response) => {
                console.log("Successfully logged in multi-account");

                const result = ParseStudentInfo(response);

                if (isBARSError(result)) throw result;

                this.mCurrentData.availableSemesters = GetAvailableSemesters(response);
                this.mCurrentData.student = result as BARSStudentInfo;
                console.timeEnd('Login&StudentInfoParser')
                console.log(this.mCurrentData.student);
                this.mCurrentData.student.headman = isHeadman;

                this.mStorage.set(STORAGE_KEYS.CREDENTIALS, JSON.stringify(creds));
                this.mStorage.set(STORAGE_KEYS.STUDENT_INFO, JSON.stringify(result));

                return Promise.resolve<"ONLINE" | "OFFLINE">("ONLINE");
              });
            });
          } else if (response.includes("Рейтинг")) {
            console.log("Successfully logged in");
            const result = ParseStudentInfo(response);
            if (isBARSError(result)) {
              console.error("BARS error detected");
              throw result;
            }

            this.mCurrentData.availableSemesters = GetAvailableSemesters(response);
            this.mCurrentData.student = result as BARSStudentInfo;
            console.timeEnd('Login&StudentInfoParser')
            console.log(this.mCurrentData.student);
            this.mCurrentData.student.headman = false;
            this.mStorage.set(STORAGE_KEYS.CREDENTIALS, JSON.stringify(creds));
            this.mStorage.set(STORAGE_KEYS.STUDENT_INFO, JSON.stringify(result));
            return Promise.resolve<"ONLINE" | "OFFLINE">("ONLINE");
          } else {
            if (response.includes("Логин состоит из символов латинского алфавита и")) {
              isIncorrectLoginPassword = true;
              throw CreateBARSError("INVALID_CREDS", "Неверный логин/пароль!");
            } else {
              throw CreateBARSError("SERVER_ERROR", "Сервер вернул неожиданный результат! Попробуйте ещё раз, если снова увидите эту ошибку, пожалуйста, сообщите разработчикам!");
            }
          }
        }).catch((e: any) => {
          //Оффлайн мод
          //this.LoadOnlineData()
          //console.log('Offline mode.', e)
          //return Promise.resolve<'ONLINE' | 'OFFLINE'>('OFFLINE')
          if (isBARSError(e)) return Promise.reject(e)
          else return Promise.reject(CreateBARSError('LOGIN_FAIL', e.toString()))
        })).catch(e => {
          if (isIncorrectLoginPassword){
            return Promise.reject(CreateBARSError('INVALID_CREDS', 'Неверный логин/пароль!'))
          } else {
            console.warn("Data download time exceeded!", e)
            if (firstStart) {
              return Promise.reject(CreateBARSError('LOGIN_FAIL', "Превышено время загрузки данных - слабое/нестабильное интернет-соединение, или проблемы со стороны БАРС! Проверьте качество сети и попробуйте ещё раз."))
            }
            else return Promise.resolve<'ONLINE' | 'OFFLINE'>('OFFLINE')
          }

      })

    })
  }

  public LoadOfflineData(){
    console.log('Loading offline data...')
    const schedule = this.mStorage.getString(STORAGE_KEYS.SCHEDULE)
    const marks = this.mStorage.getString(STORAGE_KEYS.MARKS)
    const skippedClasses = this.mStorage.getString(STORAGE_KEYS.SKIPPED_CLASSES)
    const recordBook = this.mStorage.getString(STORAGE_KEYS.RECORD_BOOK)
    const tasks = this.mStorage.getString(STORAGE_KEYS.TASKS)
    const reports = this.mStorage.getString(STORAGE_KEYS.REPORTS)
    const stipends = this.mStorage.getString(STORAGE_KEYS.STIPENDS)
    const orders = this.mStorage.getString(STORAGE_KEYS.ORDERS)
    const questionnaires = this.mStorage.getString(STORAGE_KEYS.QUESTIONNAIRES)
    const student = this.mStorage.getString(STORAGE_KEYS.STUDENT_INFO)

    //console.warn(schedule,marks,skippedClasses,recordBook,student, reports)

    if(typeof student == 'undefined'){
      DeviceEventEmitter.emit('LoginState', 'NOT_LOGGED_IN' as LoginState)
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
    Store.dispatch(updateSkippedClasses({status: "OFFLINE", data: typeof skippedClasses != 'undefined' ? JSON.parse(skippedClasses) : null}))
    Store.dispatch(updateRecordBook({status: "OFFLINE", data: typeof recordBook != 'undefined' ? JSON.parse(recordBook) : null}))
    Store.dispatch(updateReports({status: "OFFLINE", data: typeof reports != 'undefined' ? JSON.parse(reports) : null}))
    Store.dispatch(updateTasks({status: "OFFLINE", data: typeof tasks != 'undefined' ? JSON.parse(tasks) : null}))
    Store.dispatch(updateStipends({status: "OFFLINE", data: typeof stipends != 'undefined' ? JSON.parse(stipends) : null}))
    Store.dispatch(updateOrders({status: "OFFLINE", data: typeof orders != 'undefined' ? JSON.parse(orders) : null}))
    Store.dispatch(updateQuestionnaires({status: "OFFLINE", data: typeof questionnaires != 'undefined' ? JSON.parse(questionnaires) : null}))
    console.log('All offline data dispatched.')
    //DeviceEventEmitter.emit('LoginState', 'LOGGED_IN')
  }

  public get CurrentData(){
    return this.mCurrentData
  }

  public FetchRequestedSchedule(target: Teacher): Promise<BARSSchedule>{
    console.log('Trying to fetch requested schedule: ' + target.lec_oid)

    const CheckInternet = () => {
      return NetInfo.fetch()
    }

    const end  = new Date()
    const form = new FormData()
    let request_type = ''
    let normal_name = ''
    form.append('search', target.lec_oid)
    end.addDays(APP_CONFIG.DATE_RANGE)
    return CheckInternet().then((response)=> {
      if (!response.isConnected)
        return Promise.reject(CreateBARSError('INVALID_REQUEST_SCHEDULE', 'Нет подключения к интернету!'))
      else {
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
              throw CreateBARSError("INVALID_REQUEST_SCHEDULE", "По указанным данным ни группа, ни преподаватель не обнаружены! Скорректируйте ввод и попробуйте ещё раз.");
            }
          }
          fform.append('type', request_type);
          fform.append('fromDate', moment(new Date()).format('YYYY.MM.DD'))
          fform.append('toDate', moment(end).format('YYYY.MM.DD'))
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
                  cabinet: lesson.auditorium,
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

            return DealWithMeal(DealWithRepeated(res))
          })
        })
      }
    })
  }

  public FetchSchedule(): Promise<void | BARSMarks | "ONLINE" | "OFFLINE">{

    console.log('Fetching schedule')
    console.time('ScheduleParser')
    const group = this.mCurrentData.student!.group
    const g = new Date();
    g.substractDays(APP_CONFIG.DATE_RANGE);
    const dateStart = moment(g, 'DD.MM.YYYY');
    g.addDays(APP_CONFIG.DATE_RANGE * 4)
    const dateEnd = moment(g, 'DD.MM.YYYY');

    const linkSearch = 'http://ts.mpei.ru/api/search?term=' + encodeURI(group) + `&type=group`
    return Timeout(2500, fetch(linkSearch,{
      method: 'GET',
      headers: {},
      credentials: 'include'
    }).then(r=>r.json()).then(r=>{
      const linkSchedule = `http://ts.mpei.ru/api/schedule/group/${r[0].id}?start=${dateStart.format('YYYY.MM.DD')}&finish=${dateEnd.format('YYYY.MM.DD')}&lng=1`
      return fetch(linkSchedule, {
        method: 'GET',
        headers: {},
        credentials: 'include'
      }).then(r=>r.json()).then(r=>{
        const groupBy = function(xs: any, key: any) {
          return xs.reduce(function(rv: any, x: any) {
            (rv[x[key]] = rv[x[key]] || []).push(x);
            return rv;
          }, {});
        };
        let result: BARSSchedule = {
          days: [],
          todayIndex: -1
        }
        let grouped = groupBy(r, 'date');
        for(const [key, value] of Object.entries(grouped)){
          const date_ = moment(key, 'YYYY.MM.DD').format('DD.MM.YYYY')
          const day: BARSScheduleCell = {
            date: date_,
            lessons:[],
            isEmpty: false,
            isToday: date_ == moment(new Date()).format('DD.MM.YYYY')
          }
          // console.log(date_, moment(new Date()).format('DD.MM.YYYY'))
          for(let lesson of (value as any)){

            const c : BARSScheduleLesson = {
              name: lesson.discipline,
              lessonIndex: lesson.beginLesson + '-' + lesson.endLesson,
              lessonType: lesson.kindOfWork,
              place: lesson.building,
              cabinet: lesson.auditorium,
              teacher: {
                name: lesson.listOfLecturers[0].lecturer.includes('!Вакансия') ? '-' : lesson.listOfLecturers[0].lecturer,
                lec_oid: lesson.listOfLecturers[0].lecturerUID,
                fullName: lesson.listOfLecturers[0].lecturer_title
              },
              group: lesson.subGroup,
              type: 'COMMON'
            }
            day.lessons.push(c)
          }
          result.days.push(day)
        }

        for(let i = 1; i < result.days.length; i++){
          const prev = moment(result.days[i-1].date, 'DD.MM.YY').toDate()
          const curr = moment(result.days[i].date, 'DD.MM.YY').toDate()
          const missedDaysCount = (curr.getTime() - prev.getTime()) / 8640000  / 10 - 1
          for(let j = 0; j < missedDaysCount; j++){
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
            result.days.splice(i+j,0,missedDay)
          }
        }

        for (let i = 0; i < result.days.length; i++) {
          for (let j = 0; j < result.days[i].lessons.length - 1; j++) {
            const a = result.days[i].lessons[j]
            const b = result.days[i].lessons[j + 1]
            if (a.name == b.name && a.lessonIndex == b.lessonIndex) {
              console.log(a.teacher.fullName + '|' + b.teacher.fullName);

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

        const scheduleWithDinner = DealWithMeal(result)

        console.timeEnd('ScheduleParser')
        return Promise.resolve(scheduleWithDinner)
      })
    }).then((result)=>{
      Store.dispatch(updateSchedule({status: "LOADED", data: result}))
      this.mStorage.set(STORAGE_KEYS.SCHEDULE, JSON.stringify(result))
      console.log('Fetched schedule')
      DeviceEventEmitter.emit('LoginState', 'LOGGED_IN')
    }).catch((error: any)=>{
      if(isBARSError(error)){
        console.warn("Schedule fetch failed! Trying to use offline data...", error.message)

      } else {
        console.warn("Schedule fetched, but empty! Trying to use offline data...", error.message)

      }
      const scheduleRaw = this.mStorage.getString(STORAGE_KEYS.SCHEDULE)
      if(typeof scheduleRaw == 'undefined'){
        Store.dispatch(updateSchedule({status: "FAILED", data: null}))
        console.warn(error)
        throw error;
      } else {
        Store.dispatch(updateSchedule({status: "OFFLINE", data: JSON.parse(scheduleRaw)}))
        DeviceEventEmitter.emit('LoginState', 'LOGGED_IN')
      }
    })).catch(e =>{
      console.warn('Data download time exceeded on Schedule!', e)
      const scheduleRaw = this.mStorage.getString(STORAGE_KEYS.SCHEDULE)
      if(typeof scheduleRaw == 'undefined'){
        Store.dispatch(updateSchedule({status: "FAILED", data: null}))
        console.warn(e)
        throw e;
      } else {
        Store.dispatch(updateSchedule({status: "OFFLINE", data: JSON.parse(scheduleRaw)}))
        DeviceEventEmitter.emit('LoginState', 'LOGGED_IN')
      }
    })
  }


  public FetchRecordBook(): Promise<void | BARSMarks | "ONLINE" | "OFFLINE">{
    console.log('Fetching record book')
    const link = URLS.BARS_RECORD_BOOK + this.mCurrentData.student!.id
    return Timeout(5000, fetch(link, {
      method: 'GET',
      headers: COMMON_HTTP_HEADER
    }).then(r=>r.text())
    .then((response)=>{
      const semPromises: Promise<string>[] = []
      const fetchSemester = (id: number) => {
        const semLink = `https://bars.mpei.ru/bars_web/ST_LK/RecordBook/ListStudent__RecordBook?studentID=${this.mCurrentData.student!.id}&query=%7B%22ID%22%3A%22${this.mCurrentData.student!.id}%22%2C%22SortOrder%22%3Anull%2C%22Page%22%3Anull%2C%22DisplayMode%22%3A%22%22%2C%22FilterRecordBookPage%22%3A%7B%22Code%22%3A%22sem%3A${id}%22%7D%7D`
        return fetch(semLink).then(r=>r.text()).then((response)=>{
          return Promise.resolve(response)
        })
      }

      try{
        const $ = parse(response).querySelector('#recordBook__Pager')!
        let k = 0
        for(let i of $!.querySelectorAll('li')){
          if(i.querySelector('a')!.text.trim().includes('семестр')){
            k++
            semPromises.push(fetchSemester(k))
          }}
      } catch (e: any){
        throw CreateBARSError('RECORDS_PARSER_FAIL', e)
      }
      return Promise.all(semPromises).then((result)=>{
        const zek = RecordBookParser(result)
        if(isBARSError(zek)) {
          console.warn('Failed to fetch record book! Trying to use offline data... ')
          const recordBookRaw = this.mStorage.getString(STORAGE_KEYS.RECORD_BOOK)
          if(typeof recordBookRaw == 'undefined'){
            Store.dispatch(updateRecordBook({status: "FAILED", data: null}))
            console.warn(zek)
            throw zek;
          } else {
            Store.dispatch(updateRecordBook({status: "OFFLINE", data: JSON.parse(recordBookRaw)}))
          }
        } else {
          Store.dispatch(updateRecordBook({status: "LOADED", data: zek}))
          this.mStorage.set(STORAGE_KEYS.RECORD_BOOK, JSON.stringify(zek))
          console.log('Fetched record book')
        }

      })
    })).catch(e => {
      console.warn("Data download time exceeded on record book! ", e)
      const recordBookRaw = this.mStorage.getString(STORAGE_KEYS.RECORD_BOOK)
      if(typeof recordBookRaw == 'undefined'){
        Store.dispatch(updateRecordBook({status: "FAILED", data: null}))
        throw e
      } else {
        Store.dispatch(updateRecordBook({ status: "OFFLINE", data: JSON.parse(recordBookRaw) }))
      }
    })
  }

  public FetchSkippedClasses(): Promise<void | BARSMarks | "ONLINE" | "OFFLINE">{
    console.log('Fetching skipped classes')
    let link = encodeURI( //TODO Забирать не 10 а все
      URLS.BARS_SKIPPED_CLASSES +  this.mCurrentData.student!.id +'&query=' +
        JSON.stringify({
          'ID': this.mCurrentData.student!.id,
          'Page': '1',
          'PageSize': '500',
          'FilterSemester': {'value': this.mCurrentData.availableSemesters![0].id}
        })
    )
    return Timeout(2500, fetch(link,{
      method: 'GET',
      headers: {
        'Accept': `text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7`,
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'ru,en;q=0.9',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Dnt': '1',
        'Host': 'bars.mpei.ru',
        'Referer': URLS.BARS_MAIN + this.mCurrentData.student!.id,
        'Sec-Ch-Ua': `"Not.A/Brand";v="8", "Chromium";v="114", "YaBrowser";v="23"`,
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': `"Windows"`,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 YaBrowser/23.7.0.2526 Yowser/2.5 Safari/537.36'
      }
    }).then(r=>r.text()).then((response)=>{
      const skippedClasses = SkippedClassesParser(response)
      if(isBARSError(skippedClasses)){
        console.warn('Failed to fetch skipped classes! Trying to use offline data... ')
        const skippedClassesRaw = this.mStorage.getString(STORAGE_KEYS.SKIPPED_CLASSES)
        if(typeof skippedClassesRaw == 'undefined'){
          Store.dispatch(updateSkippedClasses({status: "FAILED", data: null}))
          console.warn(skippedClasses);
          throw skippedClasses;
        } else {
          Store.dispatch(updateSkippedClasses({status: "OFFLINE", data: JSON.parse(skippedClassesRaw)}))
        }
      } else {
        this.mStorage.set(STORAGE_KEYS.SKIPPED_CLASSES, JSON.stringify(skippedClasses))
        Store.dispatch(updateSkippedClasses({status: "LOADED", data: skippedClasses}))
        console.log('Fetched skipped classes')
      }
    })).catch(e =>{
      console.warn("Data download time exceeded on skipped classes! ", e)
      const skippedClassesRaw = this.mStorage.getString(STORAGE_KEYS.SKIPPED_CLASSES)
      if(typeof skippedClassesRaw == 'undefined'){
        Store.dispatch(updateSkippedClasses({status: "FAILED", data: null}))
        throw e
      } else {
        Store.dispatch(updateSkippedClasses({status: "OFFLINE", data: JSON.parse(skippedClassesRaw)}))
      }
    })
  }

  public FetchReports(): Promise<void | BARSMarks | "ONLINE" | "OFFLINE">{
    console.log('Fetching reports')
    return Timeout(1500, fetch(URLS.BARS_REPORTS + this.mCurrentData.student!.id, {method: 'GET', headers: COMMON_HTTP_HEADER})
      .then(r=>r.text()).then(
        (response)=>{
          const reports = ReportsParser(response)
          if(isBARSError(reports)){
            console.warn('Failed to fetch reports! Trying to use offline data... ')
            const reportsRaw = this.mStorage.getString(STORAGE_KEYS.REPORTS)
            if(typeof reportsRaw == 'undefined'){
              Store.dispatch(updateReports({status: "FAILED", data: null}))
              console.warn(reports)
              throw reports;
            } else {
              Store.dispatch(updateReports({status: "OFFLINE", data: JSON.parse(reportsRaw)}))
            }
          } else {
            Store.dispatch(updateReports({status: "LOADED", data: reports}))
            this.mStorage.set(STORAGE_KEYS.REPORTS, JSON.stringify(reports))
            console.log('Fetched reports')
          }
        }).catch(()=>{
        return Promise.resolve()
      })).catch(e => {
      console.warn("Data download time exceeded on reports! ", e)
      const reportsRaw = this.mStorage.getString(STORAGE_KEYS.REPORTS)
      if(typeof reportsRaw == 'undefined'){
        Store.dispatch(updateReports({status: "FAILED", data: null}))
        throw e
      } else {
        Store.dispatch(updateReports({status: "OFFLINE", data: JSON.parse(reportsRaw)}))
      }
    })
  }

  public FetchTasks(): Promise<void | BARSMarks | "ONLINE" | "OFFLINE">{
    console.log('Fetching tasks')
    return Timeout(2000, fetch(URLS.BARS_TASKS + this.mCurrentData.student!.id, {method: 'GET', headers: COMMON_HTTP_HEADER})
      .then(r=>r.text()).then(
        (response)=>{
          const tasks = TasksParser(response)
          if(isBARSError(tasks)){
            console.warn('Failed to fetch tasks! Trying to use offline data... ')
            const tasksRaw = this.mStorage.getString(STORAGE_KEYS.TASKS)
            if(typeof tasksRaw == 'undefined'){
              Store.dispatch(updateTasks({status: "FAILED", data: null}))
              console.warn(tasks)
              throw tasks;
            } else {
              Store.dispatch(updateTasks({status: "OFFLINE", data: JSON.parse(tasksRaw)}))
            }
          } else {
            Store.dispatch(updateTasks({status: "LOADED", data: tasks}))
            this.mStorage.set(STORAGE_KEYS.TASKS, JSON.stringify(tasks))
            console.log('Fetched tasks')
          }
        }).catch(()=>{
        return Promise.resolve()
      })).catch(e => {
        console.warn("Data download time exceeded on tasks! ", e)
        const tasksRaw = this.mStorage.getString(STORAGE_KEYS.TASKS)
        if(typeof tasksRaw == 'undefined'){
          Store.dispatch(updateTasks({status: "FAILED", data: null}))
          throw e
        } else {
          Store.dispatch(updateTasks({status: "OFFLINE", data: JSON.parse(tasksRaw)}))
        }
    })
  }

  public FetchQuestionnaires(): Promise<void | BARSMarks | "ONLINE" | "OFFLINE">{
    console.log('Fetching questionnaires')
    return Timeout(3000, fetch(URLS.BARS_QUESTIONNAIRES + this.mCurrentData.student!.id + '&query=%7B%22ID%22%3Anull%2C%22State%22%3Anull%2C%22SortOrder%22%3A%22EditEndDate%20desc%2CQuestionnaire.Name%22%2C%22Page%22%3A%221%22%2C%22PageSize%22%3A%22500%22%2C%22SearchText%22%3A%22%22%7D&_=1706828837554', {method: 'GET', headers: COMMON_HTTP_HEADER})
      .then(r=>r.text()).then(
        (response)=>{
          const questionnaires = QuestionnairesParser(response)
          if(isBARSError(questionnaires)){
            console.warn('Failed to fetch questionnaires! Trying to use offline data... ')
            const questionnairesRaw = this.mStorage.getString(STORAGE_KEYS.QUESTIONNAIRES)
            if(typeof questionnairesRaw == 'undefined'){
              Store.dispatch(updateQuestionnaires({status: "FAILED", data: null}))
              console.warn(questionnaires)
              throw questionnaires;
            } else {
              Store.dispatch(updateQuestionnaires({status: "OFFLINE", data: JSON.parse(questionnairesRaw)}))
            }
          } else {
            Store.dispatch(updateQuestionnaires({status: "LOADED", data: questionnaires}))
            this.mStorage.set(STORAGE_KEYS.QUESTIONNAIRES, JSON.stringify(questionnaires))
            console.log('Fetched questionnaires')
          }
        }).catch(()=>{
        return Promise.resolve()
      })).catch(e => {
        console.warn("Data download time exceeded on questionnaires! ", e)
        const questionnairesRaw = this.mStorage.getString(STORAGE_KEYS.QUESTIONNAIRES)
        if(typeof questionnairesRaw == 'undefined'){
          Store.dispatch(updateQuestionnaires({status: "FAILED", data: null}))
          throw e
        } else {
          Store.dispatch(updateQuestionnaires({status: "OFFLINE", data: JSON.parse(questionnairesRaw)}))
        }
    })
  }

  public FetchStipends(): Promise<void | BARSMarks | "ONLINE" | "OFFLINE">{
    console.log('Fetching stipends')
    return Timeout(2500, fetch(URLS.BARS_STIPENDS + this.mCurrentData.student!.id, {method: 'GET', headers: COMMON_HTTP_HEADER})
      .then(r=>r.text()).then(
        (response)=>{
          const stipends = StipendsParser(response)
          if(isBARSError(stipends)){
            console.warn('Failed to fetch stipends! Trying to use offline data... ')
            const stipendsRaw = this.mStorage.getString(STORAGE_KEYS.STIPENDS)
            if(typeof stipendsRaw == 'undefined'){
              Store.dispatch(updateStipends({status: "FAILED", data: null}))
              console.warn(stipends)
              throw stipends;
            } else {
              Store.dispatch(updateStipends({status: "OFFLINE", data: JSON.parse(stipendsRaw)}))
            }
          } else {
            Store.dispatch(updateStipends({status: "LOADED", data: stipends}))
            this.mStorage.set(STORAGE_KEYS.STIPENDS, JSON.stringify(stipends))
            console.log('Fetched stipends')
          }
        }).catch(()=>{
        return Promise.resolve()
      })).catch(e => {
        console.warn("Data download time exceeded on stipends! ", e)
        const stipendsRaw = this.mStorage.getString(STORAGE_KEYS.STIPENDS)
        if(typeof stipendsRaw == 'undefined'){
          Store.dispatch(updateStipends({status: "FAILED", data: null}))
          throw e
        } else {
          Store.dispatch(updateStipends({status: "OFFLINE", data: JSON.parse(stipendsRaw)}))
        }
    })
  }

  public FetchOrders(): Promise<void | BARSMarks | "ONLINE" | "OFFLINE">{
    console.log('Fetching orders')
    return Timeout(2000, fetch(URLS.BARS_ORDERS + this.mCurrentData.student!.id, {method: 'GET', headers: COMMON_HTTP_HEADER})
      .then(r=>r.text()).then(
        (response)=>{
          const orders = OrdersParser(response)
          if(isBARSError(orders)){
            console.warn('Failed to fetch orders! Trying to use offline data... ')
            const ordersRaw = this.mStorage.getString(STORAGE_KEYS.ORDERS)
            if(typeof ordersRaw == 'undefined'){
              Store.dispatch(updateOrders({status: "FAILED", data: null}))
              console.warn(orders)
              throw orders;
            } else {
              Store.dispatch(updateOrders({status: "OFFLINE", data: JSON.parse(ordersRaw)}))
            }
          } else {
            Store.dispatch(updateOrders({status: "LOADED", data: orders}))
            this.mStorage.set(STORAGE_KEYS.ORDERS, JSON.stringify(orders))
            console.log('Fetched orders')
          }
        }).catch(()=>{
        return Promise.resolve()
      })).catch(e => {
        console.warn("Data download time exceeded on orders! ", e)
        const ordersRaw = this.mStorage.getString(STORAGE_KEYS.ORDERS)
        if(typeof ordersRaw == 'undefined'){
          Store.dispatch(updateOrders({status: "FAILED", data: null}))
          throw e
        } else {
          Store.dispatch(updateOrders({status: "OFFLINE", data: JSON.parse(ordersRaw)}))
        }
    })
  }

  public FetchMarkTable(semesterID?: string, forPast: boolean = false): Promise<void | BARSMarks>{
    console.log('Fetching mark table...')
    // console.warn(this.mCurrentData)
    let link = URLS.BARS_MAIN + 'ST_Study/Main/Main?studentID=' + this.mCurrentData.student!.id
    if(typeof semesterID != "undefined"){
      link+= '&query='+
        JSON.stringify({
          'ID': this.mCurrentData.student!.id,
          'FilterSemester': {'value': semesterID}
        })
    }
    link = encodeURI(link)
    return fetch(link, {method: 'GET', headers: COMMON_HTTP_HEADER})
      .then(r=>r.text()).then(
        (response)=>{
          const marks = ParsMarkTable(response)
          if(forPast && !isBARSError(marks)){
            return Promise.resolve(marks)
          } else if(forPast && isBARSError(marks)){
            throw marks
          }
          if(isBARSError(marks)) {
            console.warn('Failed to fetch mark table! Trying to use offline data... ', forPast)
            const markTableRaw = this.mStorage.getString(STORAGE_KEYS.MARKS)
            if(typeof markTableRaw == 'undefined'){
              Store.dispatch(updateMarkTable({status: "FAILED", data: null}))
              console.warn(marks)
              throw marks
            } else {
              console.warn('updateMarkTable - status: "OFFLINE", data: ' + markTableRaw)
              Store.dispatch(updateMarkTable({status: "OFFLINE", data: JSON.parse(markTableRaw)}))
            }
          } else {
            Store.dispatch(updateMarkTable({status: "LOADED", data: marks}))
            this.mStorage.set(STORAGE_KEYS.MARKS, JSON.stringify(marks))
            if(this.mBackgroundMode){
              this.mCurrentData.marks = marks
            }
            console.log('Fetched mark table', forPast)
          }
        }).catch((e: any)=>{
        if(isBARSError(e)) return Promise.reject(e)
          else return Promise.reject(CreateBARSError('MARK_TABLE_PARSER_FAIL', e))
      })
  }
}
