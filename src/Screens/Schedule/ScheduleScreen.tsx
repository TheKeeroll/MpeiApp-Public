import React, { Fragment, useMemo, useRef, useState } from "react";
import { useTheme } from "react-native-paper";
import { Alert, FlatList, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { NavigationHeader } from "../CommonComponents/DrawerHeader";
import { useSelector } from "react-redux";
import { RootState } from "../../API/Redux/Store";
import { BARSSchedule, BARSScheduleCell, BARSScheduleLesson } from "../../API/DataTypes";
import moment from "moment";
import { withOpacity, CustomTheme } from "../../Themes/Themes";
import LottieView from "lottie-react-native";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import BARSAPI from "../../Common/Globals";
import { isBARSError } from "../../API/Error/Error";
import Holidays from "../CommonComponents/Holidays";
import {useDeferredInlineAd} from "../../Ads/useDeferredInlineAd";
import {YANDEX_INLINE_AD_PLACEMENTS} from "../../Ads/AdPlacements";
import {useLoyalty} from "../../Loyalty/LoyaltyProvider";
import ScheduleSearchPanel from "./ScheduleSearchPanel";
import {createScheduleSearchParams, getScheduleSearchQuery} from "./ScheduleNavigation";
import {loadingProgressService} from "../../Loading/LoadingProgressService";
import {LOADING_PROGRESS_KEYS} from "../../Loading/LoadingProgressKeys";
import {getMoscowDate, isNonTodayScheduleDate, useMoscowDate} from '../../Common/MoscowDate';
import {useDragoNetPromo} from '../../Vpn/useDragoNetPromo';
import {clampScheduleIndex, getInitialScheduleIndex} from './ScheduleSelection';

let currentYear = String(new Date().getFullYear())
let YearForFix = currentYear

const DateCell: React.FC<{
    item: BARSScheduleCell,
    index: number,
    selectedIndex: number,
    onPress: (index: number) => void,
    cellWidth: number,
    cellHeight: number,
}> = (props) =>{
    const isSelected = props.index == props.selectedIndex
    // console.log("initialDateString = " + props.item.date)
    // let dateYear = props.item.date.split('.')[2]
    let date = new Date(parseInt(YearForFix), parseInt(props.item.date.split('.')[1]) - 1, parseInt(props.item.date.split('.')[0]))
    const {isEmpty, isToday} = props.item
    const {colors} = useTheme<CustomTheme>()

    let dayNameOfTheWeek = '?'
    switch (date.getDay()) {
        case 0:
            dayNameOfTheWeek = 'Вс'
            break

        case 1:
            dayNameOfTheWeek = 'Пн'
            break

        case 2:
            dayNameOfTheWeek = 'Вт'
            break

        case 3:
            dayNameOfTheWeek = 'Ср'
            break

        case 4:
            dayNameOfTheWeek = 'Чт'
            break

        case 5:
            dayNameOfTheWeek = 'Пт'
            break

        case 6:
            dayNameOfTheWeek = 'Сб'
            break
    }
    // console.log(date.toString() + " : " + date.getDayName())
    return (
      <TouchableOpacity
        disabled={props.item.isEmpty}
        onPress={() => props.onPress(props.index)}
        style={{
            width: props.cellWidth,
            height: props.cellHeight,
            opacity: isEmpty ? .3 : 1,
            borderRadius: 8,
            backgroundColor: isSelected ? colors.surface : colors.primary
        }}>
          <View
            style={{ alignItems: 'center', justifyContent: 'space-evenly', flex: 1, opacity: isEmpty ? .3 : 1 }}>
              <Text style={{ color: colors.text }}>{dayNameOfTheWeek}</Text>
              <View style={{
                  borderRadius: 50,
                  height: 30,
                  aspectRatio: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isToday ? colors.notification : isSelected ? withOpacity(colors.accent, 80) : colors.surface
              }}>
                  <Text
                    style={{ textAlign: 'center', color: isSelected ? colors.highlight : colors.text, fontWeight: isSelected ? 'bold' : 'normal', alignSelf: 'center' }}>{date.getDate()}</Text>
              </View>
              <Text style={{ color: colors.text }}>{date.getMonthName()}</Text>
          </View>
      </TouchableOpacity>
    )
}

const DateSelector: React.FC<{
    days: BARSScheduleCell[],
    selectedIndex: number,
    initScrollIndex: number,
    onDateSelect: (index: number) => void
}> = (props) => {
    const {width, fontScale} = useWindowDimensions();
    const initialIndex = useRef(props.initScrollIndex);
    const initialScrollIndex = props.days.length > 0
        ? clampScheduleIndex(initialIndex.current, props.days.length)
        : undefined;

    const CELL_WIDTH = useMemo(() => {
        const screenWidth = width;
        const cellsPerScreen = 6; // можно настроить
        const separatorWidth = 10;
        return (screenWidth - separatorWidth * (cellsPerScreen - 1)) / cellsPerScreen;
    }, [width]);
    const selectorHeight = Math.max(80, Math.ceil(80 * Math.min(fontScale, 1.6)));
    return (
      <View collapsable={false} style={{width: '100%', marginTop: 10, height: selectorHeight}}>
          <FlatList
            data={props.days}
            keyExtractor={item => item.date}
            renderItem={({ item, index }) =>
              <DateCell
                item={item}
                index={index}
                selectedIndex={props.selectedIndex}
                onPress={props.onDateSelect}
                cellWidth={CELL_WIDTH}
                cellHeight={selectorHeight}
              />
            }
            horizontal
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
            initialScrollIndex={initialScrollIndex}
            getItemLayout={(_, index) => ({
                length: CELL_WIDTH,
                offset: (CELL_WIDTH + 10) * index,
                index
            })}
          />
      </View>
    );
};

const LessonCell: React.FC<{navigation: any, route: any, item: BARSScheduleLesson, index: number, requestMode?: boolean, isToday: boolean}> = (props) =>{
    const {colors} = useTheme<CustomTheme>()
    let {type, name, lessonIndex, place, cabinet, teacher, lessonType, group} = props.item
    const [showPlace, setShowPlace] = useState(false)
    const requestMode = typeof props.requestMode != 'undefined' || props.requestMode == true

    const NoTeacher = (name: string) => {
        const sp = name.split('|')
        return ((sp[0] == '-' && sp[1] == '-') || (sp.length == 1 && sp[0] == '-'))
    }

    const IsNow = () => {
        if(!props.isToday) return false
        const nowDate = new Date()
        const eZeroM = nowDate.getMinutes().toString().length == 1 ? '0' : ''
        const eZeroH = nowDate.getHours().toString().length == 1 ? '0' : ''
        const now = [eZeroH + nowDate.getHours(), eZeroM + nowDate.getMinutes()].join(':')
        const [start, end] = props.item.type == 'DINNER' ? ['12:45', '13:45'] : props.item.lessonIndex.split('-')
        return start < now && now < end
    }

    if(type == 'DINNER')
        return (
            <View style={{width: '90%', height: 100, alignItems: 'center', justifyContent: 'space-evenly', flexDirection: 'row', borderRadius: 10, backgroundColor: IsNow() ? colors.surface : colors.primary}}>
                <View style={{width: '23%', minWidth: 78, maxWidth: 128, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch'}}>
                    <View style={{borderRadius: 5, alignItems: 'center', justifyContent: 'center', width: '90%', minHeight: 60, paddingVertical: 3, backgroundColor: IsNow() ? colors.notification : colors.surface}}>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', marginBottom: -5, color: colors.text}}>12:45</Text>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', color: colors.text}}>-</Text>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', marginTop: -5, color: colors.text}}>13:45</Text>
                    </View>
                </View>
                <View style={{flex: .4, alignItems: 'center', justifyContent: 'center'}}>
                    <Text style={{fontWeight: 'bold', fontSize: 25, color: colors.text}}>Обед</Text>
                </View>
                <View style={{flex: .4, alignItems: 'center', justifyContent: 'center'}}>
                    <LottieView autoPlay={true} loop={true} speed={0.3} source={require('../../../assets/animations/food.json')} style={{width: 80, height: 80}}/>
                </View>
            </View>
        )
    let lessonTypeColor = colors.warning
    if (lessonType == "Лабораторная работа" || lessonType == "Экзамен" || lessonType == "Защита курсовой работы" || lessonType == "Защита курсового проекта"){
        lessonTypeColor = colors.error
    }
    else if (lessonType == "Лекция"){
        lessonTypeColor = colors.accent
    }
    let _cabinet = cabinet.split('|')[0]
    if (_cabinet.includes("Спортзал")){
        _cabinet = "Стадион/Спортзал"
    }
    if (lessonType.includes('Зачет')){
        lessonType = lessonType.replace('Зачет', 'Зачёт')
    }
    if (name.includes('счет')){
        name = name.replace('счет', 'счёт')
    }
    let teacher_1_fullName = teacher.fullName
    let teacher_2_fullName = teacher.fullName
    if (teacher.fullName?.includes('|')){
        teacher_1_fullName = teacher.fullName.split('|')[0]
        teacher_2_fullName = teacher.fullName.split('|')[1]
    }
    return (
        <View style={{width: '90%', minHeight: 100, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.primary}}>
            <View style={{flexDirection: 'row', alignItems: 'stretch', width: '100%'}}>
                <View style={{width: '23%', minWidth: 78, maxWidth: 128, alignItems: 'center', justifyContent: 'center'}}>
                    <View style={{borderRadius: 5, marginTop: 5, alignItems: 'center', justifyContent: 'center', width: '90%', minHeight: 60, paddingVertical: 3, backgroundColor: IsNow() ? colors.notification : colors.surface}}>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', marginBottom: -5, color: colors.text}}>{lessonIndex.split('-')[0]}</Text>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', color: colors.text}}>-</Text>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', marginTop: -5, color: colors.text}}>{lessonIndex.split('-')[1]}</Text>
                    </View>
                    <TouchableOpacity
                        disabled={(requestMode && typeof group == "undefined") || (!requestMode && (place?.includes('-') || place?.includes('-|-') || _cabinet.includes('Стадион') || typeof place == "undefined"))}
                        // onPress={()=>setShowPlace(p=>!p)}
                        onPress={()=> {requestMode ? setShowPlace(p=>!p) : props.navigation.push('scheduleMain', createScheduleSearchParams(_cabinet))}}
                        style={{borderRadius: 5, marginVertical: 5, alignItems: 'center', justifyContent: 'center', width: '90%', minHeight: 30, paddingVertical: 2, backgroundColor: IsNow() ? colors.notification : colors.surface}}>
                        <Text numberOfLines={2} style={{marginHorizontal: 5, textAlign: "center" ,color: IsNow() ? colors.highlight : colors.textUnderline}}>
                          {showPlace ? (requestMode ? group : place.split('|')[0]) : _cabinet}
                        </Text>
                        { type == 'COMBINED' && cabinet.split('|')[0] != cabinet.split('|')[1] &&
                            <Text adjustsFontSizeToFit numberOfLines={1}
                                  style={{textAlign: "center", color: IsNow() ? colors.highlight : colors.textUnderline}}>
                              {showPlace ? place.split('|')[1] : _cabinet}
                            </Text>
                        }
                    </TouchableOpacity>
                </View>
                <View style={{flex: 1, minWidth: 0, marginVertical: 5}}>
                        <Text style={{paddingTop: 1, paddingLeft: 2, paddingRight: 4, flexShrink: 1, fontWeight: 'bold', color: lessonTypeColor, marginVertical: 2}}>{lessonType}</Text>

                    <View style={{width: '96.5%', justifyContent: 'center', alignItems: 'center', flexGrow: 1, minHeight: 20, backgroundColor: colors.surface, borderRadius: 5}}>
                        <Text style={{fontSize: 16, color: colors.text, textAlign: 'center', marginHorizontal: 5, marginVertical: 2}}>{name}</Text>
                    </View>
                </View>
            </View>
            {!requestMode && <Fragment>
                {!NoTeacher(props.item.teacher.name) &&
                    <View style={{width: '100%', flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-evenly', minHeight: 50, padding: 4}}>
                    <TouchableOpacity
                    onPress={()=>props.navigation.push('scheduleMain', createScheduleSearchParams(teacher_1_fullName ?? teacher.name.split('|')[0]))}
                    disabled={teacher.name.split('|')[0] == '-'}
                    style={{maxWidth: '100%', flexShrink: 1, borderRadius: 5, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', minHeight: 40}}>
                    <Text style={{flexShrink: 1, color: colors.text, marginHorizontal: 5, fontSize: 16}}>{teacher.name.split('|')[0]}</Text>
                    </TouchableOpacity>
                { type == 'COMBINED' &&
                    <TouchableOpacity
                    onPress={()=>props.navigation.push('scheduleMain', createScheduleSearchParams(teacher_2_fullName ?? teacher.name.split('|')[1]))}
                    disabled={teacher.name.split('|')[1] == '-'}
                    style={{maxWidth: '100%', flexShrink: 1, borderRadius: 5, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', minHeight: 40}}>
                    <Text style={{flexShrink: 1, color: colors.text, marginHorizontal: 5, fontSize: 16}}>{teacher.name.split('|')[1]}</Text>
                    </TouchableOpacity>
                }
                </View>
            }</Fragment>}
        </View>
    )
}

const RequestedScheduleScreen: React.FC<{navigation: any, route: any, searchQuery: string}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const {recordSuccessfulFeatureUse} = useLoyalty()
    const teacherSchedule = useRef<BARSSchedule | null>(null)
    const [loadingState, setLoadingState] = useState<'LOADING' | 'OK' | 'ERROR'>('LOADING')
    const [selectedDate, setSelectedDate] = useState(0)
    const moscowToday = useMoscowDate()
    const loadedQuery = useRef<string | undefined>(undefined)
    const [resultRevision, setResultRevision] = useState(0)
    const promoDay = teacherSchedule.current?.days[selectedDate]
    const promo = useDragoNetPromo(`requested:${props.searchQuery}:${resultRevision}:${promoDay?.date ?? ''}`,
        loadingState === 'OK' && loadedQuery.current === props.searchQuery && isNonTodayScheduleDate(promoDay?.date, moscowToday))

    React.useEffect(() => {
        setLoadingState('LOADING')
        if(BARSAPI.TestMode){
            setLoadingState('ERROR')
            Alert.alert('Ошибка', 'Поиск расписания недоступен в тестовом режиме.', [{text: 'Ок', onPress: ()=> props.navigation.goBack()}])
            return
        }

        let isCancelled = false
        const progress = loadingProgressService.start(
            LOADING_PROGRESS_KEYS.scheduleSearch,
            'Поиск расписания...',
        )
        const timer = setTimeout(() => {
            loadingProgressService.advance(progress, 'Загрузка занятий...')
            BARSAPI.FetchRequestedSchedule({name: '', lec_oid: props.searchQuery}).then((result)=>{
                if(isCancelled){
                    return
                }

                teacherSchedule.current = result
                loadedQuery.current = props.searchQuery
                setResultRevision(previous => previous + 1)
                setSelectedDate(getInitialScheduleIndex(result, getMoscowDate()))
                recordSuccessfulFeatureUse('scheduleSearch')
                loadingProgressService.complete(progress)
                setLoadingState('OK')
            }, (e: any)=>{
                if(isCancelled){
                    return
                }

                if(isBARSError(e)){
                    Alert.alert('Ошибка', e.message, [{text: 'Ок', onPress: ()=> props.navigation.goBack()}])
                } else {
                    console.error(e)
                }
                loadingProgressService.fail(progress)
                setLoadingState('ERROR')
            })
        }, 200)

        return () => {
            isCancelled = true
            clearTimeout(timer)
        }
    }, [props.navigation, props.searchQuery, recordSuccessfulFeatureUse])

    if(loadingState === 'LOADING'){
        return <LoadingScreen progressKey={LOADING_PROGRESS_KEYS.scheduleSearch} fallbackLabel={'Поиск расписания...'}/>
    }

    if(loadingState === 'ERROR' || !teacherSchedule.current){
        return <></>
    }

    const requestedSchedule = teacherSchedule.current
    if(requestedSchedule.days.length === 0){
        return (
            <View style={{alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}}>
                <NavigationHeader backable {...props} title={requestedSchedule.fullTeacherName || props.searchQuery}/>
                <View style={{flex: 1, width: '90%', alignItems: 'center', justifyContent: 'center'}}>
                    <Text style={{fontSize: 18, textAlign: 'center', color: withOpacity(colors.text, 75)}}>
                        В выбранном диапазоне занятий пока нет.
                    </Text>
                </View>
            </View>
        )
    }

    const safeSelectedDate = clampScheduleIndex(selectedDate, requestedSchedule.days.length)
    const selectedDay = requestedSchedule.days[safeSelectedDate]
    const isToday = selectedDay?.date === moscowToday

    return (
        <View collapsable={false} style={{alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}}>
            <NavigationHeader backable {...props} title={requestedSchedule.fullTeacherName || props.searchQuery}/>
            <DateSelector
                days={requestedSchedule.days}
                selectedIndex={safeSelectedDate}
                onDateSelect={setSelectedDate}
                initScrollIndex={Math.max(0, safeSelectedDate - 2)}
            />
            <View ref={promo.viewportRef} collapsable={false} onLayout={promo.refreshVisibility} style={{flex: 1, width: '100%', marginTop: 10}}>
            {selectedDay ?
                <FlatList
                    style={{ width: '100%' }}
                    contentContainerStyle={{ alignItems: 'center', paddingBottom: 20 }}
                    onScroll={promo.refreshVisibility}
                    scrollEventThrottle={16}
                    onContentSizeChange={promo.refreshVisibility}
                    data={selectedDay.lessons}
                    renderItem={({ item, index }: { item: BARSScheduleLesson, index: number }) =>
                        <LessonCell requestMode {...props} item={item} index={index} isToday={isToday} />
                    }
                    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                    ListFooterComponentStyle={{width: '100%'}}
                    ListFooterComponent={promo.banner ?? undefined}
                />
                : <View style={{flex: 1}}/>
            }
            </View>
        </View>
    )
}

const PersonalScheduleScreen: React.FC<{navigation: any, route: any}> = (props) => {
    const {colors} = useTheme<CustomTheme>()
    const schedule = useSelector((state: RootState)=>state.Schedule)
    const current_month = parseInt(moment().format("M"))
    const [isFirstTime, setisFirstTime] = useState(true)
    const [selectedDate, setSelectedDate] = useState(() => getInitialScheduleIndex(schedule.data, getMoscowDate()))
    const moscowToday = useMoscowDate()
    // Resolve the initial date in render, before FlatList's first native mount.
    // Data may only become available after the loading screen has rendered.
    const safeSelectedDate = isFirstTime
        ? getInitialScheduleIndex(schedule.data, moscowToday)
        : clampScheduleIndex(selectedDate, schedule.data?.days.length ?? 0)
    const promoDay = schedule.data?.days[safeSelectedDate]
    const promo = useDragoNetPromo(`personal:${promoDay?.date ?? ''}`,
        !isFirstTime && (schedule.status === 'LOADED' || schedule.status === 'OFFLINE') && isNonTodayScheduleDate(promoDay?.date, moscowToday))
    const todayAdEligible = (schedule.status === 'LOADED' || schedule.status === 'OFFLINE')
        && promoDay?.date === moscowToday && (promoDay?.lessons.length ?? 0) > 0
    const inlineAd = useDeferredInlineAd(YANDEX_INLINE_AD_PLACEMENTS.scheduleToday, 'screen', todayAdEligible)
    const setViewportRef = React.useCallback((view: React.ComponentRef<typeof View> | null) => {
        promo.viewportRef.current = view
        inlineAd.viewportRef.current = view
    }, [promo.viewportRef, inlineAd.viewportRef])
    const openRequestedSchedule = (query: string) => {
        props.navigation.push('scheduleMain', createScheduleSearchParams(query))
    }

    React.useEffect(() => {
        if (
            !isFirstTime
            || (schedule.status !== 'OFFLINE' && schedule.status !== 'LOADED')
            || !schedule.data
        ) {
            return
        }

        const initialIndex = getInitialScheduleIndex(schedule.data, moscowToday)
        setSelectedDate(initialIndex)
        setisFirstTime(false)
    }, [isFirstTime, schedule.data, schedule.status, moscowToday])

    const isVacationPeriod = current_month === 1 || current_month === 2 || (current_month > 5 && current_month < 9)
    const hasNoPersonalSchedule = schedule.status === 'FAILED'
        || ((schedule.status === 'OFFLINE' || schedule.status === 'LOADED')
            && (!schedule.data || schedule.data.days.length === 0))
    if(hasNoPersonalSchedule){
        return (
            <View style={{alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}}>
                <NavigationHeader {...props} title={'Расписание'}/>
                <ScheduleSearchPanel onSearch={openRequestedSchedule}/>
                {isVacationPeriod ?
                    <Holidays/>
                    : <View style={{flex: 1, width: '90%', alignItems: 'center', justifyContent: 'center'}}>
                        <Text style={{fontSize: 18, textAlign: 'center', color: withOpacity(colors.text, 75)}}>
                            Личное расписание пока недоступно. Можно найти уже опубликованное расписание выше.
                        </Text>
                    </View>
                }
                {(schedule.status === 'FAILED' || schedule.status === 'OFFLINE') && (
                    <TouchableOpacity
                        onPress={() => { void BARSAPI.RetryDataSection('schedule') }}
                        style={{marginBottom: 18, minHeight: 42, paddingHorizontal: 16, justifyContent: 'center', borderRadius: 10, backgroundColor: colors.primary}}
                    >
                        <Text style={{fontWeight: '700', color: colors.text}}>Попробовать снова</Text>
                    </TouchableOpacity>
                )}
            </View>
        )
    }

    let editableScheduleData = schedule.data!

    const EmptyDay = () => (
        <View style={{width: '100%', alignSelf: 'stretch', flex: 1, alignItems: 'center', justifyContent :'center'}}>
            <Text style={{fontSize: 25, color: withOpacity(colors.text, 70)}}> </Text>
        </View>
    )

    switch(schedule.status){
        case "LOADING": return <LoadingScreen progressKey={'bars-section:schedule'} fallbackLabel={'Загрузка личного расписания...'}/>
        case "OFFLINE":
        case "LOADED":{
            const IsToday = () => {
                const today = moscowToday
                return today == schedule.data!.days[safeSelectedDate]?.date
            }
            return (
                <View collapsable={false} style={[{alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}]}>
                    <NavigationHeader {...props} title={'Расписание'}/>

                    <ScheduleSearchPanel onSearch={openRequestedSchedule}/>

                    <DateSelector days={editableScheduleData.days} selectedIndex={safeSelectedDate} onDateSelect={setSelectedDate}
                        initScrollIndex={Math.max(0, safeSelectedDate - 2)}/>
                    <View ref={setViewportRef} collapsable={false} onLayout={() => {
                        inlineAd.onViewportLayout()
                        promo.refreshVisibility()
                    }} style={{flex: 1, width: '100%', marginTop: 10}}>
                    {typeof schedule.data!.days[safeSelectedDate] != 'undefined' ?
                        <FlatList
                            {...inlineAd.scrollProps}
                            style={{width: '100%'}}
                            contentContainerStyle={{alignItems: 'center'}}
                            onScroll={event => {
                                inlineAd.scrollProps.onScroll(event)
                                promo.refreshVisibility()
                            }}
                            onContentSizeChange={() => {
                                inlineAd.scrollProps.onContentSizeChange()
                                promo.refreshVisibility()
                            }}
                            data={editableScheduleData.days[safeSelectedDate].lessons}
                            renderItem={({item,index}:{item:BARSScheduleLesson, index: number})=>
                                <LessonCell {...props} item={item} index={index} isToday={IsToday()}/>
                            }
                            ItemSeparatorComponent={()=><View style={{height: 10}}/>}
                            ListFooterComponentStyle={{width: '100%'}}
                            ListFooterComponent={<>
                                {todayAdEligible && inlineAd.banner}
                                {promo.banner}
                                <View style={{height: 20}}/>
                            </>}
                        />
                        : <EmptyDay/>}
                    </View>
                </View>
            )
        }
        default: return <></>
    }

}

const ScheduleScreen: React.FC<{navigation: any, route: any}> = (props) => {
    const searchQuery = getScheduleSearchQuery(props.route?.params)
    return searchQuery
        ? <RequestedScheduleScreen {...props} searchQuery={searchQuery}/>
        : <PersonalScheduleScreen {...props}/>
}

export default ScheduleScreen
