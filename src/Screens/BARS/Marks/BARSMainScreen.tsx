import React, { Fragment, useEffect, useState } from "react";
import {
    FlatList,
    NativeModules,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { COMMON_HTTP_HEADER, SCREEN_SIZE, URLS } from "../../../Common/Constants";
import { AdditionalData, BARSDiscipline, BARSScheduleCell, Mark, ScheduleForWidget } from "../../../API/DataTypes";
import { AverageScoreToColor, MarkToColor, withOpacity, CustomTheme } from "../../../Themes/Themes";
import { createStackNavigator } from "@react-navigation/stack";
import DetailedMarksScreen from "./DetailedMarksScreen";
import BARSAPI from "../../../Common/Globals";
import { useSelector } from "react-redux";
import { RootState, Store } from "../../../API/Redux/Store";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import { useTheme } from "react-native-paper";
import ScheduleScreen from "../../Schedule/ScheduleScreen";
import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import FetchFailed from "../../CommonComponents/FetchFailed";
import Moment from "moment";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";
import parse from "node-html-parser";
import { updateAdditionalData } from "../../../API/Redux/Slices";
import SharedGroupPreferences from "react-native-shared-group-preferences";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const Stack = createStackNavigator()

const group = 'group.com.mpeiapp'

const SharedStorage = NativeModules.SharedStorage

const FeedWidget = async () => {
  try {
    const studentSchedule = useSelector((state: RootState) => state.Schedule)
    const todayStr = new Date().getDDMMYY()

    const placeholderDay = (isToday = false): BARSScheduleCell => ({
      date: "NOT_SET",
      lessons: [{
        name: "", lessonIndex: "", lessonType: "", place: "", cabinet: "",
        teacher: { name: "", lec_oid: "", fullName: "" },
        group: "", type: "PLACEHOLDER"
      }],
      isEmpty: true,
      isToday
    })

    let dataForWidget: ScheduleForWidget = {
      yesterday: placeholderDay(),
      today: placeholderDay(true),
      tomorrow: placeholderDay()
    }
    // создаём копию массива, чтобы не мутировать state
    const days = (studentSchedule?.data?.days ?? []).map(d => ({ ...d }))

    if (days.length === 0) {
      console.log('FeedWidget - no days in schedule, using placeholders')
    } else {
      // --- поиск today ---
      const idxToday = days.findIndex(d => d.date === todayStr)

      if (idxToday !== -1) {
        // есть today
        dataForWidget = {
          yesterday: days[idxToday - 1] ?? placeholderDay(),
          today: days[idxToday],
          tomorrow: days[idxToday + 1] ?? placeholderDay()
        }
      } else {
        // today нет → ищем соседей
        const todayTime = convertDate(todayStr).getTime()
        const prevCandidates = days.filter(d => convertDate(d.date).getTime() < todayTime)
        const nextCandidates = days.filter(d => convertDate(d.date).getTime() > todayTime)
        const prevDay = prevCandidates.length ? prevCandidates[prevCandidates.length - 1] : undefined
        const nextDay = nextCandidates.length ? nextCandidates[0] : undefined

        if (prevDay || nextDay) {
          console.log('FeedWidget - Today missing. Prev:', prevDay?.date ?? 'none', ' Next:', nextDay?.date ?? 'none')
          dataForWidget = {
            yesterday: prevDay ?? placeholderDay(),
            today: placeholderDay(true),
            tomorrow: nextDay ?? placeholderDay()
          }
        } else {
          // вообще нет соседей → ищем ближайший день по модулю
          let nearest: { day: BARSScheduleCell, diff: number } | null = null
          for (const d of days) {
            const diff = Math.abs(convertDate(d.date).getTime() - todayTime)
            if (!nearest || diff < nearest.diff) nearest = { day: d, diff }
          }
          if (nearest) {
            console.log('FeedWidget - No adjacent days; using nearest available as tomorrow:', nearest.day.date)
            dataForWidget = {
              yesterday: placeholderDay(),
              today: placeholderDay(true),
              tomorrow: nearest.day
            }
          } else {
            console.log('FeedWidget - No suitable schedule found - keeping placeholders')
          }
        }
      }
    }
    // --- отправка ---
    if (Platform.OS == 'ios') {
      await SharedGroupPreferences.setItem('widgetKey', dataForWidget, group)
      console.log('iOS - dataForWidget shared')
    } else {
      SharedStorage.set(JSON.stringify({ dataForWidget }))
      console.log('Android - dataForWidget shared')
    }
  } catch (error: any) {
    console.warn('FeedWidget failed: ' + error?.toString())
  }
}

let weekDemonstration = "";
let closeBARSDate = new Date(3000, 4, 21);
let weekDColor = "#DDDDE0";
let sessionStarted = false;

let finalMarkAvailabilityCounter = 0

const CheckFinalMarkAvailability = async (id: string | undefined): Promise<string> => {
    try {
        const response = await fetch(`https://bars.mpei.ru/bars_web/ST_Study/Student_SemesterSheet/ModalEditSemesterExamAuto?uip=27&ssID=${id}`, {
            method: 'GET',
            headers: COMMON_HTTP_HEADER,
        })
        const text = await response.text()
        const examAutoPageStrongElements = parse(text).querySelectorAll('strong')

        for (let element of examAutoPageStrongElements) {
            if (element.toString().includes('согласия не выполнены')) {
                console.log('FinalMarkAvailability checked: conditions are not met.')
                return 'NO CONDITIONS'
            }
        }
        console.log('FinalMarkAvailability checked: conditions - OK!')
        const examAutoPageSpanElements = parse(text).querySelectorAll('span')
        let finalDate = 'NO DATE'
        for (let spanElement of examAutoPageSpanElements) {
            if (spanElement.toString().includes('может быть предоставлено до')) {
                finalDate = spanElement.toString().split('до ')[1].split('включительно')[0].trim()
                console.log('FinalDate = ' + finalDate)
                return finalDate
            }
        }
        return finalDate
    } catch (e:any) {
        console.warn('CheckFinalMarkAvailability : ' + e.toString())
        return 'NO CONDITIONS - CHECKING FAILED!'
    }
}

const SortMarksByDate = (marks: Mark[]) => {
    //return  marks.slice().sort((a,b)=> a.mark > b.mark ? 1 : a.mark == b.mark ? 0 : -1);
    // @ts-expect-error
    return marks.slice().sort((a,b)=>new Moment(a.date, 'DDMMYY') - new Moment(b.date, 'DDMMYY'));
}

export function convertDate(d: string)
{
    const parts = d.split(".");
    return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
}

const Discipline: React.FC<{navigation: any, discipline: BARSDiscipline, index: number}> =
    (props) => {
    const marks = useSelector((state: RootState)=>state.MarkTable)
    const {colors} = useTheme<CustomTheme>()
    const {dark} = useTheme()
    const GetMainMark = () => {
        const m = props.discipline.resultMarks[props.discipline.resultMarks.length - 1].mark
        //console.log(m == '-' ? props.discipline.sredBall : typeof m == 'undefined' ? '-' : m)
        //if(APP_CONFIG.TEST_MODE) return '-'
        return m == '-' ? props.discipline.sredBall : typeof m == 'undefined' ? '-' : m

    }
    closeBARSDate = convertDate(props.discipline.passUpUntil.split('\n')[0].trim())
    let todayDate= convertDate(new Date().getDDMMYY())

    const [discipleTextColor, setDiscipleTextColor] = useState<string>('#FFFFFF')
    const [discipleText, setDiscipleText] = useState<string>('')
    const [discipleTextSwitcher, setdiscipleTextSwitcher] = useState<boolean>(false)

    let _discipleText = GetMainMark().includes(',') ? ('Сдать до ' + props.discipline.passUpUntil.split('\n')[0].trim()) : 'Все КМ сданы'
    if (GetMainMark().includes(',')){
    }else if (GetMainMark().includes('5') || GetMainMark().includes('4') || GetMainMark().includes('3')){
        _discipleText = 'ДИСЦИПЛИНА СДАНА'
    } else _discipleText = 'Сдать до ' + props.discipline.passUpUntil.split('\n')[0].trim()
    if (_discipleText.includes('-')) _discipleText = ' '
    let _discipleTextColor = (_discipleText.includes('Все КМ') || _discipleText.includes('СДАНА')) ? colors.accent : (todayDate >= new Date(closeBARSDate.getFullYear(), (closeBARSDate.getDate() - 7) > 0 ? closeBARSDate.getMonth() : (closeBARSDate.getMonth() - 1),(closeBARSDate.getDate() - 7) > 0 ? (closeBARSDate.getDate() - 7) : 26 )) ? colors.warning : colors.text
    let typeColor : string
    let _type = props.discipline.debt ? 'Долг' : props.discipline.examType.charAt(0).toUpperCase() + props.discipline.examType.slice(1)
    if (_type.includes('без оценки')) typeColor = colors.accent
    else if (_type.includes('с оценкой')) typeColor = colors.warning
    else if (_type.includes('Долг')) typeColor = colors.highlight
    else typeColor = colors.error
    if (props.discipline.examMarks[0].mark.includes('П')) {

        _discipleText = 'Предоставлено согласие на получение оценки ПА!'
        _discipleTextColor = colors.accent

    } else if (((todayDate >= closeBARSDate) || ((closeBARSDate.toString() == "Invalid Date") && (todayDate >= new Date(todayDate.getFullYear(), todayDate.getMonth() == 11 ? 11 : 5, todayDate.getMonth() == 11 ? 23 : 5)))) && !(_discipleText == ' ' && (todayDate.getMonth() == 7 || todayDate.getMonth() == 1 ))){
        if ((GetMainMark().includes('5') || GetMainMark().includes('4') || GetMainMark().includes('3')) && !(GetMainMark().includes(','))){
            _discipleText = 'ДИСЦИПЛИНА СДАНА'
        } else _discipleText = 'Все КМ сданы'
        _discipleTextColor = colors.accent
        let breaker = false
         for (let i = 0; i < props.discipline.kms.length; i++){
             // console.log(props.discipline.kms[i])
             for (let j = 0; j < props.discipline.kms[i].marks.length; j++){
                 // console.log(props.discipline.kms[i].marks[j].mark)
                 if (parseInt(props.discipline.kms[i].marks[j].mark) <= 2 || isNaN(parseInt(props.discipline.kms[i].marks[j].mark))){
                     if (props.discipline.kms[i].marks[j].type == 'CURRENT'){
                         try {
                             if (props.discipline.kms[i].marks[j+1].type == 'NOT_TAKEN_INTO_ACCOUNT' || props.discipline.kms[i].marks[j+1].type == 'RETAKE'){
                                 if (parseInt(props.discipline.kms[i].marks[j+1].mark) <= 2 || isNaN(parseInt(props.discipline.kms[i].marks[j+1].mark))){
                                     try {
                                         if (parseInt(props.discipline.kms[i].marks[j+2].mark) <= 2 || isNaN(parseInt(props.discipline.kms[i].marks[j+2].mark))){
                                             _discipleText = 'Долг !'
                                             _discipleTextColor = colors.error
                                             breaker = true
                                             break
                                         }

                                     }catch (e: any){
                                         _discipleText = 'Долг !'
                                         _discipleTextColor = colors.error
                                         breaker = true
                                         break
                                     }
                                 }
                             }
                         }catch (e: any){
                             _discipleText = 'Долг !'
                             _discipleTextColor = colors.error
                             breaker = true
                             break
                         }
                     }
                 }
             }
             if (breaker) break
         }
    }

    useEffect(() => {
        const checkAvailability = async () => {
            if (marks.status !== "OFFLINE" && props.discipline.examAutoId !== '0') {
                const finalMarkCheckRes = await CheckFinalMarkAvailability(props.discipline.examAutoId)
                if (!finalMarkCheckRes.includes('NO CONDITIONS')) {
                    setDiscipleTextColor('#33FFFF')
                    if (!finalMarkCheckRes.includes('NO')){
                        setDiscipleText('До '+ finalMarkCheckRes + ' доступно согласие на оценку ПА!')
                    } else {
                        setDiscipleText('Доступно согласие на оценку ПА!')
                    }
                    setdiscipleTextSwitcher(true)
                    finalMarkAvailabilityCounter++
                    let add: AdditionalData = {
                        finalMarkAvailabilityCounter: finalMarkAvailabilityCounter
                    }
                    Store.dispatch(updateAdditionalData({status: "LOADED", data: add}))
                    console.log('FinalMarkAvailability confirmed - text and counter updated accordingly!')
                }
            }
        }
        checkAvailability()
    }, [])
        return (
            <View style={[Styles.disciplineView, {backgroundColor: colors.surface}]}>
                {/* Левая часть */}
                <View style={Styles.infoWrapper}>
                    <Text
                        numberOfLines={2}
                        style={[
                            Styles.passUpText,
                            {
                                color: withOpacity(
                                    discipleTextSwitcher ? discipleTextColor : _discipleTextColor,
                                    80,
                                ),
                                fontWeight: discipleTextSwitcher ? 'bold' : 'normal',
                            },
                        ]}>
                        {props.discipline.debt
                            ? ''
                            : discipleTextSwitcher
                                ? discipleText
                                : _discipleText}
                    </Text>

                    <View style={[Styles.disciplineNameView, {backgroundColor: colors.primary}]}>
                        <TouchableOpacity
                            onPress={() =>
                                props.navigation.navigate('detailedMarks', props.discipline)
                            }>
                            <Text
                                adjustsFontSizeToFit
                                numberOfLines={2}
                                style={{color: colors.text}}>
                                {props.discipline.name}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={Styles.teacherTypeWrapper}>
                        <TouchableOpacity
                            disabled
                            style={[
                                Styles.teacherBtn,
                                {backgroundColor: colors.primary, flex: 1},
                            ]}>
                            <Text
                                adjustsFontSizeToFit
                                numberOfLines={3}
                                style={{color: colors.textUnderline, textAlign: 'center'}}>
                                {props.discipline.teacher.name.length
                                    ? props.discipline.teacher.name.includes('руководитель')
                                        ? props.discipline.teacher.name.replace(
                                            '(руководитель - ',
                                            '\n(рук.',
                                        )
                                        : props.discipline.teacher.name
                                    : '-'}
                            </Text>
                        </TouchableOpacity>

                        <View
                            style={[
                                Styles.teacherBtn,
                                {
                                    flex: 1,
                                    maxWidth: '48%',
                                    backgroundColor: props.discipline.debt
                                        ? MarkToColor(GetMainMark(), dark)
                                        : colors.primary,
                                },
                            ]}>
                            <Text
                                numberOfLines={2}
                                style={{
                                    textAlign: 'center',
                                    fontWeight: 'bold',
                                    color: withOpacity(typeColor, 90),
                                }}>
                                {props.discipline.debt
                                    ? 'Долг'
                                    : props.discipline.examType
                                        .charAt(0)
                                        .toUpperCase() +
                                    props.discipline.examType.slice(1).replace(/[()]/g, '')}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Правая часть (балл) */}
                <TouchableOpacity
                    onPress={() => props.navigation.navigate('detailedMarks', props.discipline)}
                    style={Styles.markView}>
                    <Text
                        style={{
                            fontWeight: '600',
                            color: withOpacity(colors.text, 90),
                            // marginBottom: 4,
                        }}>
                        {GetMainMark().includes(',') ? 'Балл' : 'Итог'}
                    </Text>

                    <View
                        style={[
                            Styles.markColorView,
                            {
                                backgroundColor: withOpacity(
                                    GetMainMark().includes(',')
                                        ? AverageScoreToColor(GetMainMark())
                                        : MarkToColor(GetMainMark(), dark),
                                    80,
                                ),
                            },
                        ]}>
                        <Text style={[Styles.mainMarkText, {color: withOpacity(colors.text, 90)}]}>
                            {GetMainMark()}
                        </Text>
                    </View>

                    <View style={Styles.markDotsView}>
                        {props.discipline.kms.map((v, i) => (
                            <View
                                key={i}
                                style={[
                                    Styles.markDot,
                                    {
                                        backgroundColor: MarkToColor(
                                            SortMarksByDate(v.marks)[v.marks.length - 1].mark,
                                            dark,
                                        ),
                                    },
                                ]}
                            />
                        ))}
                    </View>
                </TouchableOpacity>
            </View>
        );

    }

const Body: React.FC<{navigation: any}> = (props)=>{
    const marks = useSelector((state: RootState)=>state.MarkTable)
    const {colors} = useTheme<CustomTheme>()
    const [refreshing, setRefreshing] = useState(false)
    if (!sessionStarted){
        weekDColor = colors.text
    }
    if (marks.status !== "OFFLINE") {
        useEffect(() => {

            BARSAPI.FetchMarkTable(BARSAPI.CurrentData.availableSemesters![0].id)
              .then()
              .catch(e=>{
                  console.warn(' useEffect: ' + e.toString())
            })
        }, [])

        if (refreshing){
            setRefreshing(false)
        }

    }
    switch (marks.status){
        case "FAILED": return <FetchFailed/>
        case "OFFLINE":
        case "LOADED":
            let weekDemoModified = false
            try {
                let todayDate = convertDate(new Date().getDDMMYY())
                if ((todayDate >= closeBARSDate) || ((closeBARSDate.toString() == "Invalid Date") && (todayDate >= new Date(todayDate.getFullYear(), todayDate.getMonth() == 11 ? 11 : 5, todayDate.getMonth() == 11 ? 23 : 5)))){
                    let sessionDate : Date
                    if (closeBARSDate.toString() == "Invalid Date"){
                        sessionDate = new Date(todayDate.getFullYear(), todayDate.getMonth() == 11 ? 11 : (todayDate.getMonth() == 0 ? 0 : 5), todayDate.getMonth() == 11 ? 31 : (todayDate.getMonth() == 0 ? 1 : 12))
                        console.warn('Invalid closeBARSDate! sessionDate assigned forcibly!')
                    }else {
                        sessionDate = new Date(closeBARSDate.getFullYear(), closeBARSDate.getMonth(), (closeBARSDate.getDate() + 7) > 31 ? 31 : (closeBARSDate.getDate() + 7) )
                    }

                    console.warn('session: ' + sessionDate.getDDMMYY());
                    let vacationsDate: Date
                    if (todayDate.getMonth() == 11){
                        vacationsDate = convertDate('01.02.' + (new Date().getFullYear() + 1).toString().substring(-2))
                    }
                    else if(todayDate.getMonth() < 2){
                        vacationsDate = convertDate('01.02.' + (new Date().getFullYear()).toString().substring(-2))
                    }
                    else {
                        vacationsDate = convertDate('04.07.' + new Date().getFullYear().toString().substring(-2))
                    }
                    console.warn('vacations: ' + vacationsDate.getDDMMYY());
                    if (todayDate >= vacationsDate){
                        weekDemonstration = 'Сессия завершилась'
                        weekDColor = colors.accent
                        sessionStarted = false
                    }
                    else if (todayDate >= sessionDate){
                        weekDemonstration = 'Сессия'
                        weekDColor = colors.error
                        sessionStarted = true
                        console.warn('session started!');
                    }
                    else if (!sessionStarted) {
                        weekDemonstration = 'Зачётная неделя'
                        weekDColor = colors.warning
                    }
                    weekDemoModified = true
                }
            }catch (e){
                console.warn("close bars Date failed: " + e);
            }
            return (
            <View style={Styles.listWrapper}>
                <FlatList
                    refreshing={refreshing}
                    onRefresh={()=>{
                        if(marks.status == 'OFFLINE') return
                        setRefreshing(true)
                        BARSAPI.FetchMarkTable(BARSAPI.CurrentData.availableSemesters![0].id)
                            .then(()=>setRefreshing(false))
                    }}

                    data={BARSAPI.Debts.length ? BARSAPI.Debts.concat(marks.data!.disciplines) : marks.data!.disciplines}
                    renderItem={({item, index}: {item:BARSDiscipline, index: number})=>
                        <Discipline {...props} discipline={item} index={index}/>}
                    contentContainerStyle={{alignItems: 'center'}}
                    ItemSeparatorComponent={()=><View style={{height: 20}}/> }
                    ListHeaderComponent={()=>
                        <View style={{alignItems: 'center', justifyContent: 'center'}}>
                            {(marks.status == 'OFFLINE') && <OfflineDataNotification/>}
                            <View style={Styles.weekView}>
                                <Text
                                    numberOfLines={1}
                                    adjustsFontSizeToFit
                                    style={[
                                        Styles.weekViewText,
                                        {color: weekDColor}
                                    ]}>
                                    {weekDemoModified ? weekDemonstration : (BARSAPI.Week == '-' ? " " : BARSAPI.Week + ' неделя')}
                                </Text>
                            </View>
                        </View>
                    }
                    ListFooterComponent={()=><View style={{height: 20}}/> }
                />
            </View>
        )
        case "LOADING": return <LoadingScreen/>

    }


}

const BARSMainScreen: React.FC<{navigation: any, route: any}> = () => {
    return(
        <Stack.Navigator initialRouteName={'barsMain'} screenOptions={{headerShown: false}}>
            <Stack.Screen name={'barsMain'} component={BARSMarksScreen}/>
            <Stack.Screen name={'detailedMarks'} component={DetailedMarksScreen}/>
            <Stack.Screen name={'scheduleMain'} component={ScheduleScreen}/>
        </Stack.Navigator>
    )
}

const BARSMarksScreen: React.FC<{navigation: any, route: any}> =(props) => {
    const {colors} = useTheme()
    FeedWidget().then(r => console.log('Schedule provided to widget'))
    return (
        <Fragment>
            <SafeAreaView style={{flex:0, backgroundColor: colors.backdrop}}/>
            <View style={[Styles.mainView, {backgroundColor: colors.background}]}>
                <DrawerHeader {...props} title={'Оценки'}/>
                <Body {...props}/>
            </View>
        </Fragment>
    )
}



export default BARSMainScreen


const Styles = StyleSheet.create({
    mainView:{
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1
    },
    listWrapper:{
        width: '100%',
        height: Platform.OS == 'android' ? '90%' : '95%'
    },
    weekView:{
        height: 50,
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center'
    },
    weekViewText:{
        fontWeight: 'bold',
        fontSize: 20
    },
    disciplineView: {
        flexDirection: 'row',
        width: SCREEN_SIZE.width * 0.9,
        borderRadius: 7,
        padding: 8,
        marginVertical: 6, // добавил разделитель между карточками
        alignItems: 'stretch',
    },

    infoWrapper: {
        flex: 1, // тянется на всё доступное место
        flexDirection: 'column',
        justifyContent: 'flex-start',
        paddingRight: '2%'
    },
    passUpText:{
        paddingLeft: '1.2%',
        // paddingVertical: '1%',
        paddingBottom: '1%'
    },
    disciplineNameView:{
        marginBottom: '2%',
        width: '98%',
        // marginLeft: '2%',
        minHeight: SCREEN_SIZE.height * .05,
        padding: '2%',
        borderRadius: 5,
        marginLeft: '1%'
    },
    teacherTypeWrapper: {
        flexDirection: 'row',
        justifyContent: 'space-between', // вместо space-evenly
        marginTop: 6,
    },

    teacherBtn: {
        borderRadius: 5,
        padding: 6,
        marginHorizontal: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },

    markView: {
        width: 70, // фиксированная ширина, чтобы не давила левую часть
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    markColorView: {
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        width: '100%', // заполняет всю ширину блока markView
        maxWidth: 60,
        marginVertical: 4,
    },
    mainMarkText: {
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 18
    },
    markDotsView:{
        width: '100%',
        marginTop: '5%',
        flexDirection :'row',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        height: SCREEN_SIZE.height * .02
    },
    markDot:{
        alignSelf: 'center',
        height: 5,
        marginVertical: '2%',
        marginHorizontal: '2%',
        aspectRatio: 1,
        borderRadius: 50
    }
})
