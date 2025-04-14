import React, { Fragment, useMemo, useRef, useState } from "react";
import { TextInput, useTheme } from "react-native-paper";
import { Alert, FlatList, LayoutAnimation, SafeAreaView, Text, TouchableOpacity, View, Dimensions } from "react-native";
import { NavigationHeader } from "../CommonComponents/DrawerHeader";
import { useSelector } from "react-redux";
import { RootState } from "../../API/Redux/Store";
import { BARSSchedule, BARSScheduleCell, BARSScheduleLesson, Teacher } from "../../API/DataTypes";
import moment from "moment";
import { withOpacity } from "../../Themes/Themes";
import { SCREEN_SIZE } from "../../Common/Constants";
import LottieView from "lottie-react-native";
import LoadingScreen from "../LoadingScreen/LoadingScreen";
import BARSAPI from "../../Common/Globals";
import FetchFailed from "../CommonComponents/FetchFailed";
import { isBARSError } from "../../API/Error/Error";
import Holidays from "../CommonComponents/Holidays";
import { Button } from "../Login/LoginScreen";

let currentYear = String(new Date().getFullYear())
let YearForFix = currentYear

const DateCell: React.FC<{
    item: BARSScheduleCell,
    index: number,
    selectedIndex: number,
    onPress: (index: number) => void,
    cellWidth: number
}> = (props) =>{
    const isSelected = props.index == props.selectedIndex
    // console.log( "initialDateString = " + props.item.date)
    let dateYear = props.item.date.split('.')[2]
    let date = new Date(parseInt(dateYear), parseInt(props.item.date.split('.')[1]) - 1, parseInt(props.item.date.split('.')[0]))
    // console.log('current month = ' + props.item.date.split('.')[1])
    // console.log('current YearForFix = ' + YearForFix)
    // date.setFullYear(Number(YearForFix))
    // console.log('Final date = ' + date.getDate().toString() + '.' + (date.getMonth() + 1).toString() + '.' + date.getFullYear().toString())
    const {isEmpty, isToday} = props.item
    const {colors} = useTheme()

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
            height: '100%',
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
    const dateSelectFlatListRef = useRef<FlatList | null>(null);

    const CELL_WIDTH = useMemo(() => {
        const screenWidth = Dimensions.get('window').width;
        const cellsPerScreen = 6; // можно настроить
        const separatorWidth = 10;
        return (screenWidth - separatorWidth * (cellsPerScreen - 1)) / cellsPerScreen;
    }, []);

    return (
      <View style={{ width: '100%', marginTop: 10, height: 80 }}>
          <FlatList
            ref={dateSelectFlatListRef}
            data={props.days}
            renderItem={({ item, index }) =>
              <DateCell
                item={item}
                index={index}
                selectedIndex={props.selectedIndex}
                onPress={props.onDateSelect}
                cellWidth={CELL_WIDTH}
              />
            }
            horizontal
            showsHorizontalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ width: 10 }} />}
            initialScrollIndex={props.initScrollIndex}
            getItemLayout={(_, index) => ({
                length: CELL_WIDTH + 10,
                offset: (CELL_WIDTH + 10) * index,
                index
            })}
            onScrollToIndexFailed={(info) => {
                console.warn("Failed to scroll to index!");
                setTimeout(() => {
                    dateSelectFlatListRef.current?.scrollToIndex({
                        index: info.index,
                        animated: true
                    });
                }, 500);
            }}
          />
      </View>
    );
};

const LessonCell: React.FC<{navigation: any, route: any, item: BARSScheduleLesson, index: number, requestMode?: boolean, isToday: boolean}> = (props) =>{
    const {colors} = useTheme()
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
            <View style={{width: SCREEN_SIZE.width * .9, height: 100, alignItems: 'center', justifyContent: 'space-evenly', flexDirection: 'row', borderRadius: 10, backgroundColor: IsNow() ? colors.surface : colors.primary}}>
                <View style={{flex: .2, alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                    <View style={{borderRadius: 5, alignItems: 'center', justifyContent: 'center', width: '80%', height: 60, backgroundColor: IsNow() ? colors.notification : colors.surface}}>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', marginBottom: -5, color: colors.text}}>12:45</Text>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', color: colors.text}}>-</Text>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', marginTop: -5, color: colors.text}}>13:45</Text>
                    </View>
                </View>
                <View style={{flex: .4, alignItems: 'center', justifyContent: 'center', height: '100%'}}>
                    <Text style={{fontWeight: 'bold', fontSize: 25, color: colors.text}}>Обед</Text>
                </View>
                <View style={{flex: .4, alignItems: 'center', justifyContent: 'center'}}>
                    <LottieView autoPlay={true} loop={true} speed={0.3} source={require('../../../assets/animations/food.json')} style={{width: '80%', aspectRatio: 1}}/>
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
        _cabinet = "Стадион"
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
        <View style={{width: SCREEN_SIZE.width * .9, minHeight: 100, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.primary}}>
            <View style={{flex: .8, flexDirection: 'row', width: '100%'}}>
                <View style={{flex: 0, alignItems: 'center', justifyContent: 'center'}}>
                    <View style={{borderRadius: 5, marginTop: 5, alignItems: 'center', justifyContent: 'center', width: '80%', height: 60, backgroundColor: IsNow() ? colors.notification : colors.surface}}>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', marginBottom: -5, color: colors.text}}>{lessonIndex.split('-')[0]}</Text>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', color: colors.text}}>-</Text>
                        <Text adjustsFontSizeToFit style={{fontWeight: 'bold', marginTop: -5, color: colors.text}}>{lessonIndex.split('-')[1]}</Text>
                    </View>
                    <TouchableOpacity
                        disabled={(requestMode && typeof group == "undefined") || (!requestMode && (place?.includes('-') || place?.includes('-|-') || typeof place == "undefined"))}
                        onPress={()=>setShowPlace(p=>!p)}
                        style={{borderRadius: 5, marginVertical: 5, alignItems: 'center', justifyContent: 'center', minWidth: 70, maxWidth: 120, marginHorizontal: 9, minHeight: 30, backgroundColor: IsNow() ? colors.notification : colors.surface}}>
                        <Text numberOfLines={1} style={{marginHorizontal: 5, textAlign: "center" ,color: IsNow() ? colors.highlight : colors.textUnderline}}>{showPlace ? (requestMode ? group : place.split('|')[0]) : _cabinet}</Text>
                        { type == 'COMBINED' && cabinet.split('|')[0] != cabinet.split('|')[1] &&
                            <Text adjustsFontSizeToFit numberOfLines={1}
                                  style={{textAlign: "center", color: IsNow() ? colors.highlight : colors.textUnderline}}>{showPlace ? place.split('|')[1] : _cabinet}</Text>
                        }
                    </TouchableOpacity>
                </View>
                <View style={{flex: .8, flexGrow: 1, marginVertical: 5}}>
                        <Text style={{paddingTop: 1, paddingLeft: 2, fontWeight: 'bold', color: lessonTypeColor, marginVertical: 2}}>{lessonType}</Text>

                    <View style={{width: '96.5%', justifyContent: 'center', alignItems: 'center', flexGrow: 1, minHeight: 20, backgroundColor: colors.surface, borderRadius: 5}}>
                        <Text numberOfLines={5} style={{fontSize: 16, color: colors.text, textAlign: 'center', marginHorizontal: 5, marginVertical: 2}}>{name}</Text>
                    </View>
                </View>
            </View>
            {!requestMode && <Fragment>
                {!NoTeacher(props.item.teacher.name) &&
                    <View style={{flex: .2, width: '100%', flexDirection : 'row', alignItems :'center', justifyContent: 'space-evenly', minHeight: 50}}>
                    <TouchableOpacity
                    onPress={()=>props.navigation.push('scheduleMain', teacher_1_fullName)}
                    disabled={teacher.name.split('|')[0] == '-'}
                    style={{borderRadius: 5, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', minHeight: 40}}>
                    <Text style={{color: colors.text, marginHorizontal: 5, fontSize: 16}}>{teacher.name.split('|')[0]}</Text>
                    </TouchableOpacity>
                { type == 'COMBINED' &&
                    <TouchableOpacity
                    onPress={()=>props.navigation.push('scheduleMain', teacher_2_fullName)}
                    disabled={teacher.name.split('|')[1] == '-'}
                    style={{borderRadius: 5, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', minHeight: 40}}>
                    <Text style={{color: colors.text, marginHorizontal: 5, fontSize: 16}}>{teacher.name.split('|')[1]}</Text>
                    </TouchableOpacity>
                }
                </View>
            }</Fragment>}
        </View>
    )
}


const ScheduleScreen: React.FC<{navigation: any, route: any}> = (props) => {
    const {colors} = useTheme()
    let schedule = useSelector((state: RootState)=>state.Schedule)
    const current_month = parseInt(moment().format("M"))
    const [isFirstTime, setisFirstTime] = useState(true)
    const [isShowRequestOtherSchedule, setisShowRequestOtherSchedule] = useState(false)
    const [targetSchedule, settargetSchedule] = useState('')

    if(schedule.status == 'FAILED' && ((current_month > 5 && current_month < 9) ?? ( current_month < 3))){
        return <Holidays/>
    } else if(schedule.status == 'FAILED'){
        return <FetchFailed/>
    }

    let editableScheduleData = schedule.data!


    const FindToday = (editedScheduleData: BARSSchedule) => {
        if (isFirstTime) {
            let today = new Date().getDDMMYY()

            for (let j = 0; j < editedScheduleData.days.length; j++) {
                if (editedScheduleData.days[j]!.date!.includes("2020")) {
                    editedScheduleData.days[j]!.date! = editedScheduleData.days[j]!.date!.replace("2020", "" + YearForFix)
                }
                if (today == editedScheduleData.days[j]!.date!) {
                    setisFirstTime(false)
                    setSelectedDate(j)
                    console.log('Today: ' + editedScheduleData.days[j]!.date!)
                    break
                }

            }
        }
    }

    const requestMode = typeof props.route.params != 'undefined' ? props.route.params as Teacher : null
    // const [selectedDate, setSelectedDate] = useState(schedule.data ? schedule.data!.todayIndex : 0)
    const [selectedDate, setSelectedDate] = useState(schedule.data ? schedule.data!.todayIndex : 0)



    const EmptyDay = () => (
        <View style={{width: '100%', alignSelf: 'stretch', flex: 1, alignItems: 'center', justifyContent :'center'}}>
            <Text style={{fontSize: 25, color: withOpacity(colors.text, 70)}}> </Text>
        </View>
    )

    if(requestMode != null){

        const timer = useRef(null)
        const {colors} = useTheme()
        const teacherSchedule = useRef<BARSSchedule>(null)
        const [loadingState, setLoadingState] = useState<'LOADING' | 'OK' | 'ERROR'>(BARSAPI.TestMode ? 'ERROR' : 'LOADING')


        if(BARSAPI.TestMode){
            Alert.alert('Ошибка', 'Not available in test mode!', [{text: 'Ok', onPress: ()=> props.navigation.goBack()}])
        }


        const IsToday = () => {
            const today = new Date().getDDMMYY()
            if (teacherSchedule.current!.days[selectedDate].date == undefined){
                return false
            }
            else {
                return today == teacherSchedule.current!.days[selectedDate].date
            }
        }
        if(timer.current == null){
            //@ts-ignore
            timer.current = setTimeout(()=>BARSAPI.FetchRequestedSchedule({name: '', lec_oid: props.route.params}).then((result)=>{

                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                    //@ts-ignore
                    teacherSchedule.current = result
                    result.days.forEach(v=>{
                        // console.log(v.lessons);

                    })

                    setLoadingState('OK')
            }, (e: any)=>{
                if(isBARSError(e)){
                    Alert.alert('Ошибка',e.message, [{text: 'Ok', onPress: ()=> props.navigation.goBack()}])

                } else {
                    console.error(e)
                }
                setLoadingState('ERROR')
            }), 200)
        }

        switch (loadingState){
            case "LOADING": return <LoadingScreen/>
            case "ERROR": return  <></>
            case "OK": {
                console.log("Teachers` schedule: ", teacherSchedule.current!.days[selectedDate])
                // const flatListRef = useRef<FlatList | null>(null)
                return (
                      <Fragment>
                          <SafeAreaView style={{ flex: 0, backgroundColor: colors.backdrop }} />
                          <SafeAreaView style={[{
                              alignItems: 'center',
                              justifyContent: 'center',
                              flex: 1,
                              backgroundColor: colors.background
                          }]}>
                              <NavigationHeader backable {...props} title={teacherSchedule.current!.fullTeacherName!} />
                              <DateSelector days={teacherSchedule.current!.days} selectedIndex={selectedDate}
                                            onDateSelect={setSelectedDate.bind(this)}
                                            initScrollIndex={(selectedDate - 2) >= 0 ? (selectedDate - 2) : selectedDate} />
                              {typeof teacherSchedule.current!.days[selectedDate] != 'undefined' ?
                                <FlatList
                                  // ref={flatListRef}
                                  style={{ width: '100%', marginTop: 10 }}
                                  contentContainerStyle={{ alignItems: 'center' }}
                                  data={teacherSchedule.current!.days[selectedDate].lessons}
                                  renderItem={({ item, index }: { item: BARSScheduleLesson, index: number }) =>
                                    <LessonCell requestMode {...props} item={item} index={index} isToday={IsToday()} />
                                  }
                                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                                  getItemLayout={(data, index) => (
                                    { length: 100, offset: 100 * ((index - 3) > 0 ? (index - 3) : index), index }
                                  )}
                                  /*onScrollToIndexFailed={(info) => {
                                      // Обработка ошибки прокрутки к индексу
                                      console.warn("Failed to scroll to index!")
                                      const wait = new Promise(resolve => setTimeout(resolve, 500))
                                      wait.then(() => {
                                          flatListRef.current?.scrollToIndex({ index: info.index, animated: true })})
                                  }}*/
                                />
                                : <EmptyDay />}
                          </SafeAreaView>
                      </Fragment>

                    )
                }
            }
    }

    switch(schedule.status){
        case "LOADING": return <LoadingScreen/>
        //case "FAILED": return <FetchFailed/>
        case "OFFLINE":
        case "LOADED":{
            const IsToday = () => {
                const today = new Date().getDDMMYY()
                return today == schedule.data!.days[selectedDate].date
            }

            if (isFirstTime){
                let unlistedDateIndex = schedule.data!.days.findIndex(item => item.date.includes('29.02'))

                if ((unlistedDateIndex >= 0) && (new Date().getFullYear() % 4 !== 0)){
                    editableScheduleData.days = editableScheduleData.days.filter(item => !item.date.includes('29.02'))
                    console.log("Unlisted date filtered out!")
                }
                let k = 0
                for (let j = 0; j < editableScheduleData.days.length; j++) {
                    let dateYear = editableScheduleData.days[j].date.split('.')[2]
                    // console.log('dateYear = ' + dateYear)
                    if (parseInt(dateYear) > parseInt(YearForFix)){
                        YearForFix = dateYear
                        console.log('YearForFix increased to ' + YearForFix)
                    }
                    if ((parseInt(dateYear) !== 2020) && (parseInt(dateYear) < parseInt(YearForFix))){
                        YearForFix = dateYear
                        console.log('YearForFix decreased to ' + YearForFix)
                    }
                    if (dateYear.includes('2020')){
                        editableScheduleData.days[j].date = editableScheduleData.days[j].date.replace(/\d{4}$/, YearForFix)
                        k++
                    }
                }
                if (k > 0){
                    console.log('Year fixed in ' + k + ' schedule days');
                }
                FindToday(editableScheduleData)
            }

            const lastFlatListRef = useRef<FlatList | null>(null)
            return (
                <Fragment>
                    <SafeAreaView style={{flex:0, backgroundColor: colors.backdrop}}/>
                    <SafeAreaView style={[{alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}]}>
                        <NavigationHeader {...props} title={'Расписание'}/>

                        <TouchableOpacity
                          onPress={()=>setisShowRequestOtherSchedule(p=>!p)}
                          style={{borderRadius: 5, backgroundColor: colors.surface, alignItems: 'flex-start', justifyContent: 'flex-start'}}>
                            {isShowRequestOtherSchedule &&
                              <View style={{flexDirection: 'row'}}>
                                  <TextInput
                                    onChangeText={t=>settargetSchedule(t)}
                                    placeholder={'Укажите группу/преподавателя'}
                                    textContentType={'name'}
                                    placeholderTextColor={withOpacity(colors.text, 40)}
                                    underlineColor={colors.text}
                                    activeUnderlineColor={colors.textUnderline}
                                    style={{backgroundColor: colors.background, width: '75%', height:'5%', borderRadius: 5, justifyContent:'center'}}
                                    theme={{colors}}
                                  />
                                  <Button title={'Найти'} onPress={()=>props.navigation.push('scheduleMain', targetSchedule)} style={{ width: '20%', height:'5%', aspectRatio: 1}}/>
                              </View>}
                            {!isShowRequestOtherSchedule &&
                              <Text style={{color: colors.textUnderline, marginHorizontal: 5, marginVertical:5, fontSize: 16}}>{'Другая группа/преподаватель'}</Text>
                            }
                        </TouchableOpacity>

                        <DateSelector days={editableScheduleData?.days} selectedIndex={selectedDate} onDateSelect={setSelectedDate.bind(this)} initScrollIndex={(selectedDate - 2) >= 0 ? (selectedDate - 2) : selectedDate }/>
                        {typeof schedule.data!.days[selectedDate] != 'undefined' ?
                            <FlatList
                                ref={lastFlatListRef}
                                style={{width: '100%', marginTop: 10}}
                                contentContainerStyle={{alignItems: 'center'}}
                                data={editableScheduleData.days[selectedDate].lessons}
                                renderItem={({item,index}:{item:BARSScheduleLesson, index: number})=>
                                    <LessonCell {...props} item={item} index={index} isToday={IsToday()}/>
                                }
                                ItemSeparatorComponent={()=><View style={{height: 10}}/>}
                                getItemLayout={(data, index) => (
                                  { length: 100, offset: 100 * ((index - 3) > 0 ? (index - 3) : index), index }
                                )}
                                onScrollToIndexFailed={(info) => {
                                    // Обработка ошибки прокрутки к индексу
                                    console.warn("Failed to scroll to index!")
                                    const wait = new Promise(resolve => setTimeout(resolve, 500))
                                    wait.then(() => {
                                        lastFlatListRef.current?.scrollToIndex({ index: info.index, animated: true })})
                                }}
                            />
                            : <EmptyDay/>}
                    </SafeAreaView>
                </Fragment>
            )
        }
        default: return <></>
    }

}

export default ScheduleScreen
