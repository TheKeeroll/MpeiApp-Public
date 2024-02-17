import React, { Fragment, useEffect, useState } from "react";
import {
    StyleSheet,
    Text,
    SafeAreaView,
    TouchableOpacity,
    View, FlatList, LayoutAnimation, Platform
} from "react-native";
import {SCREEN_SIZE} from "../../../Common/Constants";
import {BARSDiscipline, Mark} from "../../../API/DataTypes";
import {MarkToColor, AverageScoreToColor, withOpacity} from "../../../Themes/Themes";
import {createStackNavigator} from "@react-navigation/stack";
import DetailedMarksScreen from "./DetailedMarksScreen";
import BARSAPI from "../../../Common/Globals";
import {useSelector} from 'react-redux'
import {RootState} from "../../../API/Redux/Store";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import {useTheme} from "react-native-paper";
import ScheduleScreen from "../../Schedule/ScheduleScreen";
import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import FetchFailed from "../../CommonComponents/FetchFailed";
import Moment from "moment";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";
import { APP_CONFIG } from "../../../Common/Config";
const Stack = createStackNavigator()

let weekDemonstration = "";
let closeBARSDate = new Date(3000, 4, 21);
let weekDColor = "#DDDDE0";
let sessionStarted = false;

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
    const {colors, dark} = useTheme()
    const GetMainMark = () => {
        const m = props.discipline.resultMarks[props.discipline.resultMarks.length - 1].mark
        //console.log(m == '-' ? props.discipline.sredBall : typeof m == 'undefined' ? '-' : m)
        if(APP_CONFIG.TEST_MODE) return '-'
        return m == '-' ? props.discipline.sredBall : typeof m == 'undefined' ? '-' : m

    }
    closeBARSDate = convertDate(props.discipline.passUpUntil.split('\n')[0].trim())
    let todayDate= convertDate(new Date().getDDMMYY())
    let discipleText = GetMainMark().includes(',') ? ('Сдать до ' + props.discipline.passUpUntil.split('\n')[0].trim()) : 'Все КМ сданы'
    if (GetMainMark().includes(',')){
    }else if (!(GetMainMark().includes('5') || GetMainMark().includes('4') || GetMainMark().includes('3')) ){
        discipleText = 'Сдать до ' + props.discipline.passUpUntil.split('\n')[0].trim()
    }
    if (discipleText.includes('-')) discipleText = ' '
    let discipleTextColor = discipleText.includes('Все КМ') ? colors.accent : (todayDate >= new Date(closeBARSDate.getFullYear(), (closeBARSDate.getDate() - 7) > 0 ? closeBARSDate.getMonth() : (closeBARSDate.getMonth() - 1),(closeBARSDate.getDate() - 7) > 0 ? (closeBARSDate.getDate() - 7) : 26 )) ? colors.warning : colors.text
    let typeColor : string
    let _type = props.discipline.debt ? 'Долг' : props.discipline.examType.charAt(0).toUpperCase() + props.discipline.examType.slice(1)
    if (_type.includes('без оценки')) typeColor = colors.accent
    else if (_type.includes('с оценкой')) typeColor = colors.warning
    else if (_type.includes('Долг')) typeColor = colors.highlight
    else typeColor = colors.error
    if ((todayDate >= closeBARSDate) || ((closeBARSDate.toString() == "Invalid Date") && (todayDate >= new Date(todayDate.getFullYear(), todayDate.getMonth() == 11 ? 11 : 5, todayDate.getMonth() == 11 ? 23 : 5)))){
        discipleText = 'Все КМ сданы'
        discipleTextColor = colors.accent
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
                                             discipleText = 'Долг !'
                                             discipleTextColor = colors.error
                                             breaker = true
                                             break
                                         }

                                     }catch (e: any){
                                         discipleText = 'Долг !'
                                         discipleTextColor = colors.error
                                         breaker = true
                                         break
                                     }
                                 }
                             }
                         }catch (e: any){
                             discipleText = 'Долг !'
                             discipleTextColor = colors.error
                             breaker = true
                             break
                         }
                     }
                 }
             }
             if (breaker) break
         }
    }
    return (
        <View style={[Styles.disciplineView, {backgroundColor: colors.surface}]}>
            <View style={Styles.infoWrapper}>
                <Text
                        style={[
                            Styles.passUpText,
                            {color: withOpacity(discipleTextColor, 80)}
                        ]}>
                        {props.discipline.debt ? '' : discipleText}
                </Text>
                <View style={[Styles.disciplineNameView, {backgroundColor: colors.primary}]}>
                    <Text adjustsFontSizeToFit style={{color: colors.text}}>{props.discipline.name}</Text>
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
                    console.warn('vacantions: ' + vacationsDate.getDDMMYY());
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
