import { createDrawerNavigator, DrawerContentScrollView } from "@react-navigation/drawer";
import React, {Fragment, JSX, useState} from "react";
import BARSMainScreen, { convertDate } from "./Marks/BARSMainScreen";
import RecordBookScreen from "./RecordBook/RecordBookScreen";
import ReportsScreen from "./Reports/ReportsScreen";
import SkippedClassesScreen from "./SkippedClasses/SkippedClassesScreen";
import { Linking, Text, TouchableOpacity, View} from "react-native";
import { DrawerActions, getFocusedRouteNameFromRoute } from "@react-navigation/native";
import BARSAPI from "../../Common/Globals";
import { CapitalizeFirstChar } from "../../Common/Globals";
import { SCREEN_SIZE, URLS } from "../../Common/Constants";
// @ts-expect-error
import * as EIcon from "react-native-vector-icons/Entypo";
// @ts-expect-error
import * as ADIcon from "react-native-vector-icons/AntDesign";
// @ts-expect-error
import * as FAIcon from "react-native-vector-icons/FontAwesome";
// @ts-expect-error
import * as IonIcon from 'react-native-vector-icons/Ionicons';
import { useTheme } from "react-native-paper";
import { AverageScoreToColor, withOpacity, CustomTheme } from "../../Themes/Themes";
import Clipboard from "@react-native-clipboard/clipboard";
import QuestionnairesScreen from "./Questionnaires/QuestionnairesScreen";
import TasksScreen from "./Tasks/TasksScreen";
import StipendsScreen from "./Stipends/StipendsScreen";
import OrdersScreen from "./Orders/OrdersScreen";
import { useSelector } from "react-redux";
import { RootState } from "../../API/Redux/Store";
import { SkippedClass } from "../../API/DataTypes";
import BooksScreen from "./Books/BooksScreen";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import InlineBannerAd from "../../Ads/InlineBannerAd";
import {YANDEX_INLINE_AD_PLACEMENTS} from "../../Ads/AdPlacements";

const Drawer = createDrawerNavigator()

const SpacingBig = () => (<View style={{height: 25.5, width: '100%'}}/>)

const DrawerHeader: React.FC = () => {
    const {colors} = useTheme<CustomTheme>()
    const student = BARSAPI.CurrentData.student!
    let study_rating_text = 'NO_VALUE'
    let complex_rating_text = 'NO_VALUE'
    let study_rating_color = colors.warning
    let complex_rating_color = colors.warning
    const weekString = BARSAPI.Week
    const week = parseInt(weekString)

    try {
        if (parseFloat(student.study_rating) <= 5.0) {
            study_rating_color = colors.text
        }
        else if (parseFloat(student.study_rating) >= 75.0) {
            study_rating_color = colors.accent
        }
        else if (parseFloat(student.study_rating) < 50.0) {
            study_rating_color = colors.error
            if (!isNaN(week)){
                if (week < 12){
                    study_rating_color = colors.text
                }
            }
        }
        if (parseFloat(student.complex_rating) <= 5.0) {
            complex_rating_color = colors.text
        }
        else if (parseFloat(student.complex_rating) >= 40.0) {
            complex_rating_color = colors.accent
        }
        else if (parseFloat(student.complex_rating) < 25.0 ){
            complex_rating_color = colors.error
            if (!isNaN(week)) {
                if (week < 12) {
                    complex_rating_color = colors.text
                }
            }
        }
        study_rating_text = ''  + student.study_rating.trim()
        complex_rating_text = '' + student.complex_rating.trim()
        if (student.study_rating.includes('не распарсилось')){
            study_rating_text = 'NO_VALUE'
        }
        if (student.complex_rating.includes('не распарсилось')){
            complex_rating_text = 'NO_VALUE'
        }
    } catch (e:any) {
        console.warn('study/complex rating is missing: ' + e.toString())
    }

    let av_scorePA_text = ''
    let av_scoreZK_text = ''
    let av_scorePA_color = colors.warning
    let av_scoreZK_color = colors.warning
    try {
        av_scorePA_text = ''  + student.average_scorePA.trim()
        av_scoreZK_text = '' + student.average_scoreZK.trim()
        if (student.average_scorePA.includes('не распарсилось')){
            av_scorePA_text = 'NO_VALUE'
        }
        if (student.average_scoreZK.includes('не распарсилось')){
            av_scoreZK_text = 'NO_VALUE'
        }
        av_scorePA_color = AverageScoreToColor(student.average_scorePA)
        av_scoreZK_color = AverageScoreToColor(student.average_scoreZK)
    } catch (e:any) {
        console.warn('av_score PA/ZK is missing: ' + e.toString());
    }

    let status_color = colors.accent
    try {
        if (student.status.includes("аверш")){
            status_color = '#33FFFF'
        }
        else if (student.status.includes("ременн")){
            status_color = colors.warning
        }
        else if (student.status.includes("тчислен")){
            status_color = colors.error
        }
    } catch (e:any) {
        console.warn('status is missing: ' + e.toString())
    }

    return (
        <View style={{width: '90%', alignSelf: 'center', borderRadius: 5, marginTop: 10, minHeight: SCREEN_SIZE.height * .005, backgroundColor: colors.surface}}>
            <View style={{width: '100%', padding: 8, flexDirection: 'row'}}>
                <View style={{flex: 0.99}}>
                    <View style={{width: '100%', flexDirection: 'row'}}>
                        {(student?.name) &&
                        <Text
                          numberOfLines={2}
                          style={{fontSize: 16, fontWeight: '600', paddingTop: '1%', paddingLeft: '2%', color: colors.text}}>
                            {(student?.name?.includes('не распарсилось') ? '' : student?.name) + ' ' + (student?.surname?.includes('не распарсилось') ? '' : student?.surname)}
                        </Text>
                        }
                    </View>
                    {(student?.indexBook) &&
                        <View style={{width: '100%', flexDirection: 'row'}}>
                            <TouchableOpacity style={{flexDirection: 'row'}} onPress={()=> Clipboard.setString(student?.indexBook ?? ' ')}>
                                <Text
                                    style={{fontSize: 12, textDecorationLine: 'underline', paddingTop: '1%', paddingLeft: '2%', color: withOpacity(colors.text, 90)}}>
                                    {'№ ЗК ' + (student?.indexBook?.includes('не распарсилось') ? '' : student?.indexBook)}
                                </Text>
                                <IonIcon.default name={'copy-outline'} size={18} adjustsFontSizeToFit
                                    color={withOpacity(colors.text, 80)}
                                    style={{justifySelf: 'center', marginHorizontal: 8, marginVertical: 2}}
                                />
                            </TouchableOpacity>
                        </View>
                    }
                    {((!study_rating_text.includes('NO_VALUE')) || (!complex_rating_text.includes('NO_VALUE'))) && <>
                        <Text style={{fontSize: 14, fontWeight: 'bold', paddingTop: '1%', paddingLeft: '2%', color: withOpacity(colors.text, 90)}}>{'Рейтинги: '}</Text>
                        <View style={{width: '100%', flexDirection: 'row', flexWrap: 'wrap'}}>
                            {(!study_rating_text.includes('NO_VALUE')) &&
                                <Text style={{fontSize: 12, paddingTop: '1%', paddingLeft: '2%', marginRight: 8}}>
                                    <Text style={{color: withOpacity(colors.text, 90)}}>{'Учебный: '}</Text>
                                    <Text style={{color: withOpacity(study_rating_color, 90)}}>{study_rating_text}</Text>
                                </Text>
                            }
                            {(!complex_rating_text.includes('NO_VALUE')) &&
                                <Text style={{fontSize: 12, paddingTop: '1%', paddingLeft: '2%'}}>
                                    <Text style={{color: withOpacity(colors.text, 90)}}>{'Компл.: '}</Text>
                                    <Text style={{color: withOpacity(complex_rating_color, 90)}}>{complex_rating_text}</Text>
                                </Text>
                            }
                        </View>
                    </>
                    }
                    {((!av_scorePA_text.includes('NO_VALUE')) || (!av_scoreZK_text.includes('NO_VALUE'))) && <>
                        <Text style={{fontSize: 14, fontWeight: 'bold', paddingTop: '1%', paddingLeft: '2%', color: withOpacity(colors.text, 90)}}>{'Средние баллы: '}</Text>
                        <View style={{width: '100%', flexDirection: 'row', flexWrap: 'wrap'}}>
                            {(!av_scorePA_text.includes('NO_VALUE')) &&
                                <Text style={{fontSize: 12, paddingTop: '1%', paddingLeft: '2%', marginRight: 8}}>
                                    <Text style={{color: withOpacity(colors.text, 90)}}>{'ПА: '}</Text>
                                    <Text style={{fontSize: 12, fontWeight: 'bold', fontStyle: 'italic', color: withOpacity(av_scorePA_color, 90)}}>{av_scorePA_text}</Text>
                                </Text>
                            }
                            {(!av_scoreZK_text.includes('NO_VALUE')) &&
                                <Text style={{fontSize: 12, paddingTop: '1%', paddingLeft: '2%'}}>
                                    <Text style={{color: withOpacity(colors.text, 90)}}>{'ЗК: '}</Text>
                                    <Text style={{fontSize: 12, fontWeight: 'bold', fontStyle: 'italic', color: withOpacity(av_scoreZK_color, 90)}}>{av_scoreZK_text}</Text>
                                </Text>
                            }
                        </View>
                    </>
                    }
                    {(student?.status) &&
                    <Text style={{fontSize: 14, fontWeight: 'bold', paddingVertical: '1%', paddingLeft: '2%', color: withOpacity(status_color, 90)}}>{CapitalizeFirstChar(student?.status?.includes('не распарсилось') ? '' : student?.status)}</Text>
                    }
                </View>
                <View style={{flex: .6, alignItems: 'flex-end', justifyContent: 'flex-start'}}>
                    {(student?.group) &&
                    <Text adjustsFontSizeToFit numberOfLines={1} style={{paddingTop: '2%', paddingRight: '4%', color: colors.text, fontWeight: 'bold'}}>{student?.group?.includes('не распарсилось') ? '' : student?.group}</Text>
                    }
                    {(student?.direction) &&
                    <Text adjustsFontSizeToFit numberOfLines={1} style={{ paddingTop: '1%', paddingRight: '4%', color: withOpacity(colors.textUnderline, 90)}}>{CapitalizeFirstChar(student?.direction?.includes('не распарсилось') ? '' : student?.direction)}</Text>
                    }
                </View>
            </View>
        </View>
    )
}

const DrawerButton: React.FC<{ navigation: any, presserId: number, id: number, onPress:()=>void, title: string, routeName: string, iconComponent: JSX.Element, counter: number, counterColor: string}> = (props) => {
    const isExit = props.routeName == 'exit'
    const isFocused = props.presserId == props.id || isExit && false
    const {colors} = useTheme<CustomTheme>()
    // const navigation = useNavigation()
    const onPress = () => {
        if(isExit){
            BARSAPI.Logout()
        } else {
            if(isFocused){
                props.navigation.closeDrawer()
            }
            props.navigation.dispatch(DrawerActions.closeDrawer())
            requestAnimationFrame(()=> {
                props.onPress()
                props.navigation.navigate(props.routeName)
            })
        }
    }
    return (
        <TouchableOpacity onPress={onPress.bind(this)} style={{alignSelf: 'center', width: '90%', flexDirection: 'row', alignItems: 'center', marginVertical: 5, minHeight: 45, paddingVertical: 5, borderRadius: 5, backgroundColor: isFocused ? colors.highlight : colors.surface}}>
            <View style={{width: 46, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', borderRadius: 5, marginHorizontal: 5, backgroundColor: colors.surface}}>
                {props.iconComponent}
            </View>
            <Text style={{flex: 1, flexShrink: 1, fontWeight: '700', color: withOpacity(colors.text, 80)}}>{props.title}</Text>
            {props.counter > 0 && (
              <View style={{ marginLeft: 'auto', marginRight: 10, backgroundColor: colors.backdrop, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ color: props.counterColor, fontWeight: 'bold'}}>{props.counter}</Text>
              </View>
            )}
        </TouchableOpacity>
    )
}

const DrawerContent: React.FC<{navigation: any}> = (props)=>{
    const [pressedId, setPressedId] = useState(0)
    const {colors} = useTheme<CustomTheme>()
    const insets = useSafeAreaInsets();
    let mail_str = 'загрузка...'
    let mail_color = colors.warning
    let mail_button_flag = false
    let mail_retry_flag = false
    const mail = useSelector((state: RootState)=>state.Mail)
    if (mail.status != 'LOADING'){
        try {
            if (mail.status === 'FAILED' || mail.data?.unreadCount == 'не удалось обновить'){
                mail_str = 'не удалось обновить'
                mail_color = colors.error
                mail_retry_flag = true
            } else if (mail.data?.unreadCount == '0'){
                mail_str = 'новых писем нет'
                mail_color = colors.accent
                mail_button_flag = false
            } else if (mail.data?.unreadCount == '1'){
                mail_str = '1 новое письмо'
                mail_button_flag = true
            } else { // @ts-expect-error
                if ((parseInt(mail.data?.unreadCount) >= 2) && (parseInt(mail.data?.unreadCount) <= 4)){
                    mail_str = mail.data?.unreadCount + ' новых письма'
                } else {
                    mail_str = mail.data?.unreadCount + ' новых писем!'
                    mail_color = colors.error
                }
                mail_button_flag = true
            }
        } catch (e: any) {
            console.warn('Drawer, mail - ' + e.toString())
        }
    }


    let todayDate= convertDate(new Date().getDDMMYY())

    let activeStipendsCounter = 0
    const stipends = useSelector((state: RootState)=>state.Stipends)
    if (stipends.status != 'LOADING'){
        try {
            for (let i = 0; i <= (stipends.data!.stipends.length - 1); i++) {
                if (todayDate <= convertDate(stipends.data!.stipends[i].end_date)){
                    activeStipendsCounter++
                }
            }
        } catch (e:any){
            console.warn('Drawer, activeStipendsCounter - ' + e.toString())
        }
    }

    const skippedClasses = useSelector((state: RootState)=>state.SkippedClasses)
    let skippedCounter = 0
    if (skippedClasses.status != 'LOADING'){
        try {
            let total_skipped = skippedClasses.data!.length * 2
            const skippedClassesMap: Map<string, SkippedClass[]> = new Map()
            for(let i of skippedClasses.data!){
                if(typeof skippedClassesMap.get(i.lesson) == 'undefined') skippedClassesMap.set(i.lesson, [])
                skippedClassesMap.get(i.lesson)!.push(i)
            }
            const skippedClassesArray = Array.from(skippedClassesMap, ([, v])=>v)
            let goodExcuseCount = 0
            for(let i of skippedClassesArray)
                for(let k of i)
                    if(k.goodExcuse)
                        goodExcuseCount++
            goodExcuseCount *= 2

            skippedCounter = total_skipped - goodExcuseCount
        } catch (e:any){
            console.warn('Drawer, skippedCounter - ' + e.toString())
        }
    }
    let skippedCounterColor = colors.warning
    if (skippedCounter >= 20 && skippedCounter <= 40){
        skippedCounterColor = colors.notification
    } else if (skippedCounter >= 40){
        skippedCounterColor = colors.error
    }

    const tasks = useSelector((state: RootState)=>state.Tasks)
    let unhandledTasksCounter = 0
    if (tasks.status != 'LOADING'){
        try {
            for (let i = 0; i <= (tasks.data!.length - 1); i++) {
                if (!tasks.data![i].status.includes('ознакомлен')) {
                    unhandledTasksCounter++
                }
            }
        } catch (e:any){
            console.warn('Drawer, unhandledTasksCounter - ' + e.toString())
        }
    }

    const reports = useSelector((state: RootState)=>state.Reports)
    let unhandledReportsCounter = 0
    if (reports.status != 'LOADING'){
        try {
            for (let i = 0; i <= (reports.data!.length - 1); i++) {
                if (!reports.data![i].status.includes('завершена')) {
                    unhandledReportsCounter++
                }
            }
        } catch (e:any){
            console.warn('Drawer, unhandledReportsCounter - ' + e.toString())
        }
    }

    const books = useSelector((state: RootState)=>state.Books)
    let expiredBooksCounter = 0
    let warningBooksCounter = 0
    if (books.status != 'LOADING'){
        try {
            for (let i = 0; i <= (books.data!.books.length - 1); i++) {
                if (todayDate >= convertDate(books.data!.books[i].return_until)) {
                    expiredBooksCounter++
                } else if (new Date(todayDate.getFullYear(), (todayDate.getDate() + 14) <= 31 ? todayDate.getMonth() : (todayDate.getMonth() + 1), (todayDate.getDate() + 14) <= 31 ? (todayDate.getDate() + 14) : (todayDate.getDate() + 14) - 31) >= convertDate(books.data!.books[i].return_until)) {
                    warningBooksCounter++
                }
            }
        } catch (e:any){
            console.warn('Drawer, expired/warning books counter - ' + e.toString())
        }
    }

    const questionnaires = useSelector((state: RootState)=>state.Questionnaires)
    let unhandledQuestionnairesCounter = 0
    if (questionnaires.status != 'LOADING'){
        try {
            for (let i = 0; i <= (questionnaires.data!.length - 1); i++) {
                if (!questionnaires.data![i].status.includes('завершено')) {
                    unhandledQuestionnairesCounter++
                }
            }
        } catch (e:any){
            console.warn('Drawer, unhandledQuestionnairesCounter - ' + e.toString())
        }
    }

    const marks = useSelector((state: RootState)=>state.MarkTable)
    let currentDebtsCounter = 0
    if (marks.status != 'LOADING'){
        try {
            for (let l = 0; l <= (marks.data!.disciplines.length - 1); l++) {
                let passUpUntil = marks.data!.disciplines[l].passUpUntil
                if (!passUpUntil) continue
                let closeBARSDate = convertDate(passUpUntil.split('\n')[0].trim())
                if (((todayDate >= closeBARSDate) || ((closeBARSDate.toString() == "Invalid Date") && (todayDate >= new Date(todayDate.getFullYear(), todayDate.getMonth() == 11 ? 11 : 5, todayDate.getMonth() == 11 ? 23 : 5)))) && !(passUpUntil.split('\n')[0].trim() == '-' && (todayDate.getMonth() == 7 || todayDate.getMonth() == 1 ))) {
                    let breaker = false
                    for (let i = 0; i < marks.data!.disciplines[l].kms.length; i++) {
                        for (let j = 0; j < marks.data!.disciplines[l].kms[i].marks.length; j++) {
                            if (parseInt(marks.data!.disciplines[l].kms[i].marks[j].mark) <= 2 || isNaN(parseInt(marks.data!.disciplines[l].kms[i].marks[j].mark))) {
                                if (marks.data!.disciplines[l].kms[i].marks[j].type == 'CURRENT') {
                                    try {
                                        if (marks.data!.disciplines[l].kms[i].marks[j + 1].type == 'NOT_TAKEN_INTO_ACCOUNT' || marks.data!.disciplines[l].kms[i].marks[j + 1].type == 'RETAKE') {
                                            if (parseInt(marks.data!.disciplines[l].kms[i].marks[j + 1].mark) <= 2 || isNaN(parseInt(marks.data!.disciplines[l].kms[i].marks[j + 1].mark))) {
                                                try {
                                                    if (parseInt(marks.data!.disciplines[l].kms[i].marks[j + 2].mark) <= 2 || isNaN(parseInt(marks.data!.disciplines[l].kms[i].marks[j + 2].mark))) {
                                                        currentDebtsCounter++
                                                        breaker = true
                                                        break
                                                    }

                                                } catch (e: any) {
                                                    currentDebtsCounter++
                                                    breaker = true
                                                    break
                                                }
                                            }
                                        }
                                    } catch (e: any) {
                                        currentDebtsCounter++
                                        breaker = true
                                        break
                                    }
                                }
                            }
                        }
                        if (breaker) break
                    }
                }
            }
        } catch (e:any){
            console.warn('Drawer, currentDebtsCounter - ' + e.toString())
        }
    }
    const additional = useSelector((state: RootState)=>state.AdditionalData)
    let _finalMarkAvailabilityCounter = 0
    if (additional.status != 'LOADING'){
        try {
            _finalMarkAvailabilityCounter = additional.data!.finalMarkAvailabilityCounter
        } catch (e:any){
            console.warn('Drawer, finalMarkAvailabilityCounter - ' + e.toString())
        }
    }

    return(
        <Fragment>
            <SafeAreaView edges={['left', 'bottom']} style={{flex: 1, backgroundColor: colors.background}}>
                <DrawerContentScrollView>
                    <DrawerHeader/>
                    <View style={{width: '90%', alignSelf: 'center', borderRadius: 5, marginTop: 10, minHeight: SCREEN_SIZE.height * .005, backgroundColor: colors.surface}}>
                        <View style={{width: '100%', flexDirection: 'row'}}>
                            <View style={{flex: .7}}>
                                <View style={{width: '100%', flexDirection: 'column'}}>
                                    <View style={{width: '100%', minHeight: '2%', alignItems: 'center', flexDirection: 'row'}}>
                                        <IonIcon.default name={'mail-open-outline'} size={25} adjustsFontSizeToFit
                                            color={withOpacity(colors.text, 80)}
                                            style={{alignItems: 'flex-start', justifyContent: 'flex-start', borderRadius: 5, height: 35, marginLeft: 8, marginRight: 8, marginVertical: 8}}
                                        />
                                        <Text
                                          numberOfLines={1}
                                          style={{fontSize: 14, textAlign: 'center', paddingVertical: 8, fontWeight: 'bold', color: colors.text}}>
                                            {'Почта:'}
                                        </Text>
                                        <Text
                                          numberOfLines={1}
                                          style={{fontSize: 14, marginLeft: 4, paddingVertical: 8, fontWeight: 'bold', color: withOpacity(mail_color, 90)}}>
                                            {mail_str}
                                        </Text>
                                        {mail_retry_flag && (
                                          <TouchableOpacity
                                            accessibilityLabel={'Повторить проверку почты'}
                                            onPress={() => { void BARSAPI.RetryDataSection('mail') }}
                                            style={{marginLeft: 'auto', marginRight: 8, padding: 7}}
                                          >
                                            <IonIcon.default name={'reload-outline'} size={20} color={colors.textUnderline}/>
                                          </TouchableOpacity>
                                        )}
                                    </View>
                                    {(mail_button_flag) &&
                                      <TouchableOpacity onPress={()=> Linking.openURL(mail.data?.mode == 'legacy' ? `${URLS.MAIL_LEGACY}/owa/?ae=Folder&t=IPF.Note` : (URLS.MAIL_MODERN + '/owa/'))} style={[{backgroundColor: colors.surface, borderRadius: 15, paddingLeft: '2%', alignItems: 'flex-start', justifyContent: 'space-evenly'}]}>
                                          <Text adjustsFontSizeToFit style={{fontSize: 14, marginLeft: 8, marginBottom: 8, color: colors.textUnderline, fontWeight: 'bold'}}>{'Перейти в ОСЭП'}</Text>
                                      </TouchableOpacity>
                                    }
                                </View>
                            </View>
                        </View>
                    </View>
                    <SpacingBig/>
                    <DrawerButton
                        id={0}
                        presserId={pressedId}
                        onPress={setPressedId.bind(this, 0)}
                        routeName={'barsMainDrawer'} {...props}
                        title={'Оценки'}
                        iconComponent={<EIcon.default name={'bar-graph'} size={18} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                        counter={_finalMarkAvailabilityCounter > 0 ? _finalMarkAvailabilityCounter : (currentDebtsCounter > 0 ? currentDebtsCounter : (BARSAPI.Debts.length ? BARSAPI.Debts.length : 0))}
                        counterColor={_finalMarkAvailabilityCounter > 0 ? '#33FFFF' : colors.error }
                    />
                    <DrawerButton
                        id={1}
                        presserId={pressedId}
                        onPress={setPressedId.bind(this, 1)}
                        routeName={'recordBook'} {...props}
                        title={'Зачётная книжка'}
                        iconComponent={<ADIcon.default name={'book'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                        counter={0}
                        counterColor={colors.text}
                    />
                    <DrawerButton
                        id={2}
                        presserId={pressedId}
                        onPress={setPressedId.bind(this, 2)}
                        routeName={'skippedClasses'} {...props}
                        title={'Пропуски'}
                        iconComponent={<FAIcon.default name={'calendar'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                        counter={skippedCounter}
                        counterColor={skippedCounterColor}
                    />
                    <DrawerButton
                      id={3}
                      presserId={pressedId}
                      onPress={setPressedId.bind(this, 3)}
                      routeName={'tasks'} {...props}
                      title={'Задания'}
                      iconComponent={<FAIcon.default name={'tasks'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                      counter={unhandledTasksCounter}
                      counterColor={colors.warning}
                    />
                    <DrawerButton
                        id={4}
                        presserId={pressedId}
                        onPress={setPressedId.bind(this, 4)}
                        routeName={'reports'} {...props}
                        title={'Отчёты'}
                        iconComponent={<FAIcon.default name={'file-text'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                        counter={unhandledReportsCounter}
                        counterColor={colors.warning}
                    />
                    <DrawerButton
                      id={5}
                      presserId={pressedId}
                      onPress={setPressedId.bind(this, 5)}
                      routeName={'stipends'} {...props}
                      title={'Стипендии'}
                      iconComponent={<FAIcon.default name={'money'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                      counter={activeStipendsCounter}
                      counterColor={colors.accent}
                    />
                    <DrawerButton
                      id={6}
                      presserId={pressedId}
                      onPress={setPressedId.bind(this, 6)}
                      routeName={'orders'} {...props}
                      title={'Приказы'}
                      iconComponent={<FAIcon.default name={'list-alt'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                      counter={0}
                      counterColor={colors.textUnderline}
                    />
                    <DrawerButton
                      id={7}
                      presserId={pressedId}
                      onPress={setPressedId.bind(this, 7)}
                      routeName={'books'} {...props}
                      title={'Книги'}
                      iconComponent={<FAIcon.default name={'book'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                      counter={expiredBooksCounter > 0 ? expiredBooksCounter : warningBooksCounter}
                      counterColor={expiredBooksCounter > 0 ? colors.error : colors.warning}
                    />
                    <DrawerButton
                      id={8}
                      presserId={pressedId}
                      onPress={setPressedId.bind(this, 8)}
                      routeName={'questionnaires'} {...props}
                      title={'Анкеты'}
                      iconComponent={<ADIcon.default name={'questioncircleo'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                      counter={unhandledQuestionnairesCounter}
                      counterColor={colors.warning}
                    />
                    <InlineBannerAd placement={YANDEX_INLINE_AD_PLACEMENTS.drawer}/>

                </DrawerContentScrollView>
                <DrawerButton {...props} presserId={-1} id={-2} onPress={()=>{}} title={'Выйти'} routeName={'exit'} counter={0} counterColor={colors.text} iconComponent={
                    <EIcon.default name={'log-out'} color={colors.notification} adjustsFontSizeToFit size={20}/>
                }/>
            </SafeAreaView>
        </Fragment>
    )
}

const BARSDrawer: React.FC = () => {
    const {colors} = useTheme<CustomTheme>()
    return (
        <Drawer.Navigator
        // useLegacyImplementation={true}
            drawerContent={(props)=><DrawerContent {...props}/>}
            initialRouteName={'barsMainDrawer'}
            screenOptions={{headerTintColor: colors.text, headerShown: false, headerTitleStyle:{color: colors.text}}}
        >
            <Drawer.Screen name={'barsMainDrawer'} component={BARSMainScreen}
                options={({route})=>{
                    const routeName = getFocusedRouteNameFromRoute(route) ?? 'barsMainDrawer'
                    return {
                        swipeEnabled: routeName != 'detailedMarks' && routeName != 'settingsScreen' && routeName != 'settings',
                        headerShown: false
                    }
                }}
            />
            <Drawer.Screen
                name={'recordBook'}
                component={RecordBookScreen}
                options={{
                    title: 'Зачётная книжка'
                }}
            />
            <Drawer.Screen
                name={'reports'}
                component={ReportsScreen}
                options={{
                    title: 'Отчёты'
                }}
            />
            <Drawer.Screen
              name={'books'}
              component={BooksScreen}
              options={{
                  title: 'Книги'
              }}
            />
            <Drawer.Screen
              name={'questionnaires'}
              component={QuestionnairesScreen}
              options={{
                  title: 'Анкеты'
              }}
            />
            <Drawer.Screen
                name={'skippedClasses'}
                component={SkippedClassesScreen}
                options={{
                    title: 'Пропуски',
                    headerShown: false
                }}
            />
            <Drawer.Screen
              name={'tasks'}
              component={TasksScreen}
              options={{
                  title: 'Задания',
                  headerShown: false
              }}
            />
            <Drawer.Screen
              name={'stipends'}
              component={StipendsScreen}
              options={{
                  title: 'Стипендии',
                  headerShown: false
              }}
            />
            <Drawer.Screen
              name={'orders'}
              component={OrdersScreen}
              options={{
                  title: 'Приказы',
                  headerShown: false
              }}
            />
        </Drawer.Navigator>
    )
}

export default BARSDrawer
