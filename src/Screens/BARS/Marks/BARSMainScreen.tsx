import React, { Fragment, useEffect, useState } from "react";
import {
    FlatList,
    LayoutAnimation, Linking,
    NativeModules,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { COMMON_HTTP_HEADER, SCREEN_SIZE, URLS } from "../../../Common/Constants";
import { AdditionalData, BARSDiscipline, Mark, ScheduleForWidget } from "../../../API/DataTypes";
import { AverageScoreToColor, MarkToColor, withOpacity } from "../../../Themes/Themes";
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

const Stack = createStackNavigator()

const group = 'group.com.mpeiapp'

const SharedStorage = NativeModules.SharedStorage

const FeedWidget = async () => {
    try {
        let YearForFix = String(new Date().getFullYear())

        let studentSchedule = useSelector((state: RootState)=>state.Schedule)
        let today = new Date().getDDMMYY()
        let isTodayFound = false

        let dataForWidget: ScheduleForWidget = {yesterday: {date: "NOT_SET", lessons: [{name: "", lessonIndex: "", lessonType: "", place: "", cabinet: "", teacher: {name: "", lec_oid: "", fullName: ""}, group: "", type: "PLACEHOLDER"}], isEmpty: true, isToday: false}, today: {date: "NOT_SET", lessons: [{name: "", lessonIndex: "", lessonType: "", place: "", cabinet: "", teacher: {name: "", lec_oid: "", fullName: ""}, group: "", type: "PLACEHOLDER"}], isEmpty: true, isToday: true}, tomorrow: {date: "NOT_SET", lessons: [{name: "", lessonIndex: "", lessonType: "", place: "", cabinet: "", teacher: {name: "", lec_oid: "", fullName: ""}, group: "", type: "PLACEHOLDER"}], isEmpty: true, isToday: false}}
        try {
            for (let j = 0; j < studentSchedule.data!.days.length; j++) {
                let dateYear = studentSchedule.data!.days[j]!.date.split('.')[2]
                // console.log('dateYear = ' + dateYear)
                if (parseInt(dateYear) > parseInt(YearForFix)) {
                    YearForFix = studentSchedule.data!.days[j]!.date.split('.')[2]
                    console.log('FeedWidget - YearForFix increased to ' + YearForFix)
                }
                if ((parseInt(dateYear) !== 2020) && (parseInt(dateYear) < parseInt(YearForFix))) {
                    YearForFix = studentSchedule.data!.days[j]!.date.split('.')[2]
                    console.log('FeedWidget - YearForFix decreased to ' + YearForFix)
                }

                if (studentSchedule.data!.days[j]!.date!.includes("2020")) {
                    studentSchedule.data!.days[j]!.date! = studentSchedule.data!.days[j]!.date!.replace("2020", "" + YearForFix)
                }
                try {
                    if (studentSchedule.data!.days[j + 1]!.date!.includes("2020")) {
                        studentSchedule.data!.days[j + 1]!.date! = studentSchedule.data!.days[j + 1]!.date!.replace("2020", "" + YearForFix)
                    }
                } catch (e) {
                    console.warn('studentSchedule.data!.days[j+1] not exists! j = ' + j)
                }
                if (today == studentSchedule.data!.days[j]!.date!) {
                    isTodayFound = true
                    try {
                        console.log('Yesterday: ' + studentSchedule.data!.days[j - 1]!.date!)
                        console.log('Tomorrow: ' + studentSchedule.data!.days[j + 1]!.date!)
                        dataForWidget = {
                            yesterday: studentSchedule.data!.days[j - 1]!,
                            today: studentSchedule.data!.days[j]!,
                            tomorrow: studentSchedule.data!.days[j + 1]!
                        }
                    } catch (e) {
                        try {
                            console.log('Tomorrow: ' + studentSchedule.data!.days[j + 1]!.date!)
                            dataForWidget = {
                                yesterday: {date: "NOT_SET", lessons: [{name: "", lessonIndex: "", lessonType: "", place: "", cabinet: "", teacher: {name: "", lec_oid: "", fullName: ""}, group: "", type: "PLACEHOLDER"}], isEmpty: true, isToday: false},
                                today: studentSchedule.data!.days[j]!,
                                tomorrow: studentSchedule.data!.days[j + 1]!
                            }
                            console.warn('dataForWidget without yesterday!')
                        } catch (e) {
                            try {
                                console.log('Yesterday: ' + studentSchedule.data!.days[j - 1]!.date!)
                                dataForWidget = {
                                    yesterday: studentSchedule.data!.days[j-1]!,
                                    today: studentSchedule.data!.days[j]!,
                                    tomorrow: {date: "NOT_SET", lessons: [{name: "", lessonIndex: "", lessonType: "", place: "", cabinet: "", teacher: {name: "", lec_oid: "", fullName: ""}, group: "", type: "PLACEHOLDER"}], isEmpty: true, isToday: false}
                                }
                                console.warn('dataForWidget without tomorrow!')
                            } catch (e) {
                                dataForWidget = {
                                    yesterday: {date: "NOT_SET", lessons: [{name: "", lessonIndex: "", lessonType: "", place: "", cabinet: "", teacher: {name: "", lec_oid: "", fullName: ""}, group: "", type: "PLACEHOLDER"}], isEmpty: true, isToday: false},
                                    today: studentSchedule.data!.days[j]!,
                                    tomorrow: {date: "NOT_SET", lessons: [{name: "", lessonIndex: "", lessonType: "", place: "", cabinet: "", teacher: {name: "", lec_oid: "", fullName: ""}, group: "", type: "PLACEHOLDER"}], isEmpty: true, isToday: false}
                                }
                                console.warn('dataForWidget only with today!')
                            }
                        }
                    }
                    console.log('Today: ' + studentSchedule.data!.days[j]!.date!)
                    break
                }
                /*dataForWidget = {
                    yesterday: studentSchedule.data!.days[j],
                    today: studentSchedule.data!.days[j + 1],
                    tomorrow: studentSchedule.data!.days[j + 2]
                }
                console.log('Test start date: ' + studentSchedule.data!.days[j]!.date!)
                break*/
            }
            if (!isTodayFound) {
                if (convertDate(studentSchedule.data!.days[0]!.date!) > convertDate(new Date().getDDMMYY())){
                    dataForWidget = {
                        yesterday: {date: "NOT_SET", lessons: [{name: "", lessonIndex: "", lessonType: "", place: "", cabinet: "", teacher: {name: "", lec_oid: "", fullName: ""}, group: "", type: "PLACEHOLDER"}], isEmpty: true, isToday: false},
                        today: {date: "NOT_SET", lessons: [{name: "", lessonIndex: "", lessonType: "", place: "", cabinet: "", teacher: {name: "", lec_oid: "", fullName: ""}, group: "", type: "PLACEHOLDER"}], isEmpty: true, isToday: true},
                        tomorrow: studentSchedule.data!.days[0]!
                    }
                    console.log('Only future schedule found - dataForWidget prepared accordingly');
                } else {
                    console.log('Suitable schedule not found - empty dataForWidget will be provided')
                }
            }

        } catch (error) {
            console.warn('preparing dataForWidget failed, empty schedule will be provided! Reason: ' + error)
        }
        if(Platform.OS == 'ios'){
            await SharedGroupPreferences.setItem('widgetKey', dataForWidget, group)
        } else {
            // Android
            SharedStorage.set(JSON.stringify({dataForWidget}))
        }
    } catch (error:any) {
        console.warn( 'FeedWidget failed: ' + error.toString())
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
    // @ts-ignore
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
    const {colors, dark} = useTheme()
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
            <View style={Styles.infoWrapper}>
                <Text
                        numberOfLines={2}
                        style={[
                            Styles.passUpText,
                            {color: withOpacity((discipleTextSwitcher ? discipleTextColor : _discipleTextColor), 80),
                             fontWeight: discipleTextSwitcher ? 'bold' : 'normal'}
                        ]}>
                        {props.discipline.debt ? '' : (discipleTextSwitcher ? discipleText : _discipleText)}
                </Text>
                <View style={[Styles.disciplineNameView, {backgroundColor: colors.primary}]}>
                    <TouchableOpacity
                      onPress={()=>props.navigation.navigate('detailedMarks', props.discipline)}>
                    <Text adjustsFontSizeToFit style={{color: colors.text}}>{props.discipline.name}</Text>
                    </TouchableOpacity>
                </View>
                <View style={Styles.teacherTypeWrapper}>
                    <TouchableOpacity
                        onPress={()=> {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                            props.navigation.navigate('scheduleMain', '-')
                        }}
                        disabled={'-' == '-'}
                        style={[Styles.teacherBtn,{backgroundColor: colors.primary}]}>
                        <Text adjustsFontSizeToFit={true} numberOfLines={3} style={{color: colors.textUnderline}}>
                            {props.discipline.teacher.name.length ? (props.discipline.teacher.name.includes('руководитель') ? props.discipline.teacher.name.replace('(руководитель - ', '\n(рук.') : props.discipline.teacher.name) : '-'}
                        </Text>
                    </TouchableOpacity>
                    <View style={[Styles.teacherBtn, {maxWidth: '50%', backgroundColor: props.discipline.debt ? MarkToColor(GetMainMark(), dark) : colors.primary}]}>
                        <Text
                            numberOfLines={2}
                            style={{textAlign: 'center', fontWeight: 'bold', color: withOpacity(typeColor, 90)}}>
                            {props.discipline.debt ? 'Долг' : props.discipline.examType.charAt(0).toUpperCase() + props.discipline.examType.slice(1).replace('(','').replace(')', '')}
                        </Text>
                    </View>
                </View>
                {(discipleText.includes('оступно согласие')) &&
                  <TouchableOpacity onPress={()=> Linking.openURL(URLS.BARS_MAIN + 'ST_Study/Main/Main?studentID=' + BARSAPI.mCurrentData.student?.id)} style={[{backgroundColor: colors.surface, borderRadius: 5, marginLeft: '2%', marginBottom: '2%', padding: '2%', alignItems: 'flex-start', justifyContent: 'space-evenly'}]}>
                        <Text adjustsFontSizeToFit style={{color: colors.textUnderline}}>{'Перейти на сайт БАРС'}</Text>
                  </TouchableOpacity>
                }
            </View>
            <TouchableOpacity
                onPress={()=>props.navigation.navigate('detailedMarks', props.discipline)}
                style={Styles.markView}>
                <Text
                    style={{fontWeight: '600', color: withOpacity(colors.text, 90)}}>
                    {GetMainMark().includes(',') ? 'Балл' : 'Итог'}
                </Text>
                <View style={[Styles.markColorView,
                    {backgroundColor:
                            withOpacity(GetMainMark().includes(',') ?
                                AverageScoreToColor(GetMainMark())
                                : MarkToColor(GetMainMark(), dark)
                                , 80
                            )}]}>
                    <Text
                        style={[Styles.mainMarkText, {color: withOpacity(colors.text, 90)}]}>
                        {GetMainMark()}
                    </Text>
                </View>
                <View style={Styles.markDotsView}>
                    {props.discipline.kms.map((v, i)=>(
                        <View key={i} style={[Styles.markDot, {backgroundColor: MarkToColor(SortMarksByDate(v.marks)[v.marks.length - 1].mark, dark)}]}/>
                    ))}
                </View>
            </TouchableOpacity>
        </View>
    )
}

const Body: React.FC<{navigation: any}> = (props)=>{
    const marks = useSelector((state: RootState)=>state.MarkTable)
    const {colors} = useTheme()
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
            <SafeAreaView style={[Styles.mainView, {backgroundColor: colors.background}]}>
                <DrawerHeader {...props} title={'Оценки'}/>
                <Body {...props}/>
            </SafeAreaView>
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
    disciplineView:{
        justifyContent: 'space-between',
        alignItems: 'center',
        flexDirection: 'row',
        width: SCREEN_SIZE.width * .9,
        minHeight: SCREEN_SIZE.height * .1,
        borderRadius: 7
    },
    infoWrapper:{
        flex: .77,
        flexDirection: 'column',
        justifyContent: 'space-evenly'
    },
    passUpText:{
        paddingLeft: '4%',
        paddingVertical: '1%'
    },
    disciplineNameView:{
        marginBottom: '2%',
        width: '100%',
        marginLeft: '2%',
        minHeight: SCREEN_SIZE.height * .05,
        padding: '2%', borderRadius: 5
    },
    teacherTypeWrapper:{
        marginBottom: '2%',
        marginLeft: '2%',
        flexDirection: 'row',
        justifyContent: 'space-evenly'
    },
    teacherBtn:{
        borderRadius: 5,
        minWidth: '40%',
        marginHorizontal: '2%',
        padding: '2%',
        alignItems: 'center',
        justifyContent: 'center'
    },
    markView:{
        flex: .2,
        marginVertical: '.5%',
        marginRight: '1%',
        alignItems: 'center',
        justifyContent: 'flex-start'
    },
    markColorView:{
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent :'center',
        borderRadius: 5,
        height: SCREEN_SIZE.height * .07
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
