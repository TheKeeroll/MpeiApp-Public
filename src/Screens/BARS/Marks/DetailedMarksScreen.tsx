import React, {Fragment, useState} from "react";
import {
    FlatList,
    LayoutAnimation, Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import {SCREEN_SIZE} from "../../../Common/Constants";
import {BARSDiscipline, KM, Mark} from "../../../API/DataTypes";
import {MarkToColor, withOpacity} from "../../../Themes/Themes";
import {useTheme} from "react-native-paper";
import BARSAPI from "../../../Common/Globals";
import * as MtIcons from "react-native-vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
const Moment = require('moment')


const SortMarksByDate = (marks: Mark[]) => {
     //return  marks.slice().sort((a,b)=> a.mark > b.mark ? 1 : a.mark == b.mark ? 0 : -1);
    return marks.slice().sort((a,b)=>new Moment(a.date, 'DDMMYY') - new Moment(b.date, 'DDMMYY'));
}

const MarkTypeToText = (mark: Mark) => {
    switch (mark.type){
        case "CURRENT": return 'Итог'
        case "NOT_TAKEN_INTO_ACCOUNT": return 'Не уч.'
        case "RETAKE": return 'Пересдана'
        case "RED_SESSION": return 'КС'
        case "RETAKE_EXAM_1": return 'ППА1'
        case "RETAKE_EXAM_2": return 'ППА2'
        default: return 'unknown'
    }
}

const Cell: React.FC<{item: KM, index: number}> = (props) =>{
    const {colors, dark} = useTheme()
    const [prev, setPrev] = useState(false)
    const prevMark = props.item.marks.length > 1 ? props.item.marks[1] : null
    //console.log('B', props.item.marks)
    //console.log('A', SortMarksByDate(props.item.marks))
    //const sorted = SortMarksByDate(props.item.marks)
    const mark = SortMarksByDate(props.item.marks)[props.item.marks.length - 1];

    let week_color = colors.textUnderline
    let week_font: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | undefined = "normal"
    if (parseInt(props.item.week.trim().split(' (')[0]) == parseInt(BARSAPI.mCurrentWeek)){
        week_color = colors.notification
        week_font = "bold"
    }
    return (
        <View style={[Styles.cellView, {backgroundColor: colors.surface}]}>
            <View style={{flex: .75, minHeight: 80, marginVertical: 5}}>
                <View style={[Styles.kmNameWrapper, {backgroundColor: colors.primary}]}>
                    <Text
                        numberOfLines={8}
                        style={{padding: '2%', width: '100%', color: withOpacity(colors.text, 80)}}>
                        {props.item.name.trim()}
                    </Text>
                </View>
                <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                    <Text
                      numberOfLines={1}
                      style={{color: withOpacity(week_color, 60), fontWeight: week_font, marginTop: 2}}>
                        {'Неделя ' + props.item.week.trim().split(' (')[0]}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{color: withOpacity(colors.text, 60), marginTop: 2}}>
                        {props.item.weight.trim() + '%'}
                    </Text>
                </View>
            </View>

            <TouchableOpacity
                onPress={()=>{
                LayoutAnimation.configureNext(LayoutAnimation.Presets.spring)
                setPrev(!prev)
            }} disabled={/*props.item.marks.length == 1 */ true}
                style={[Styles.kmMarkTouchable,{backgroundColor: colors.primary}]}>
                <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={{padding: prev ? '3%' : 0, fontWeight: 'bold', color: withOpacity(colors.text, 80)}}>
                    {MarkTypeToText(mark)}
                </Text>
                {prev &&
                    <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={{fontWeight: 'bold', color: withOpacity(colors.text, 80)}}>
                        {props.item.marks[1].date}
                    </Text>
                }
                <View style={[Styles.markCircle,
                    {backgroundColor: MarkToColor(mark.mark, dark)}]}>
                    <Text
                        adjustsFontSizeToFit
                        numberOfLines={1}
                        style={{fontWeight: 'bold', textAlign: 'center', fontSize: 20, color: colors.text}}>
                        {mark.mark}
                    </Text>
                </View>
                <View
                    style={[Styles.markIndicator,
                        {
                            backgroundColor:
                                prevMark != null ? MarkToColor(prevMark.mark, dark)
                                    : '000',
                            opacity: prevMark != null ? prev ? 0 : 1 : 0
                        }]}/>
            </TouchableOpacity>
        </View>
    )
}

const MarkCell: React.FC<{mark: Mark, index: number}> = (props) => {
    const {colors, dark} = useTheme()
    return (
        <View key={props.index}
              style={[Styles.markCellView, {backgroundColor: colors.primary}]}>
            <Text style={{fontWeight: 'bold', color: colors.text}}>
                {props.index == 1 ? '' : MarkTypeToText(props.mark)}
            </Text>
            <View style={[Styles.markColor, {backgroundColor: MarkToColor(props.mark.mark, dark)}]}>
                <Text style={{fontWeight: 'bold', fontSize: 15, color: colors.text}}>{props.mark.mark}</Text>
            </View>
            <Text adjustsFontSizeToFit numberOfLines={1} style={{fontWeight: 'bold', color: withOpacity(colors.text, 80)}}>{props.mark.date}</Text>
        </View>
    )
}


const ResultMarks: React.FC<{marks: Mark[]}> = (props) => {

    return (
        <View style={Styles.resultMarksView}>
            <ScrollView
                style={{flex:1}}
                contentContainerStyle={{alignItems: 'center', justifyContent: 'center', flexGrow: 1}}
                horizontal>
                {props.marks.map((v,i)=>(
                    <MarkCell key={i} mark={v} index={i+1}/>
                ))}
            </ScrollView>
        </View>
    )
}

const DetailedMarksScreen: React.FC<{navigation: any, route: any}> = (props) => {
    const {colors} = useTheme()
    const insets = useSafeAreaInsets()
    const discipline: BARSDiscipline = props.route.params

    const Header = () => (
        <View style={[Styles.header, {backgroundColor: colors.backdrop}]}>
            <Text
                numberOfLines={3}
                adjustsFontSizeToFit
                style={{ fontSize: 16, fontWeight: '600', alignSelf: 'center', color: colors.text}}>
                {discipline.name}
            </Text>
        </View>
    )


    return (
        <Fragment>
            {Platform.OS == 'ios' &&
              <TouchableOpacity onPress={()=>props.navigation.goBack()}
                                style={{height: 40, width: 90, borderRadius: 5, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', backgroundColor: colors.primary, position: 'absolute', top: insets.top, left: 5}}>
                  <MtIcons.default size={40} color={colors.text} name={'navigate-before'} adjustsFontSizeToFit/>
              </TouchableOpacity>
            }
            <SafeAreaView style={{flex: 0, backgroundColor: colors.backdrop}}/>
            <Header/>
            <FlatList
                showsVerticalScrollIndicator={false}
                style={[Styles.listResultMarks, {backgroundColor: colors.background}]}
                data={discipline.kms}
                renderItem={({item, index}: {item: KM, index: number})=><Cell item={item} index={index}/>}
                ListHeaderComponent={()=>{
                    return (
                      (discipline.examMarks[0].mark != '-' && !(discipline.examMarks[0].mark.includes('П'))) ?
                            <ResultMarks marks={discipline.examMarks}/>
                            : <View style={{height: 20}}/>
                    )
                }}
                ItemSeparatorComponent={()=><View style={{height: 20}}/>}
            />
        </Fragment>
    )
}

const Styles = StyleSheet.create({
    header:{
        width: '100%',
        minHeight: SCREEN_SIZE.height * .05,
        justifyContent: 'center'
    },
    listResultMarks:{
        height: SCREEN_SIZE.height * .92,
        width: '100%'
    },
    resultMarksView:{
        width: '100%',
        height: SCREEN_SIZE.height * .12,
        marginVertical: 20
    },
    markCellView:{
        alignItems: 'center',
        justifyContent: 'space-around',
        height: '90%',
        aspectRatio: .8,
        borderRadius: 5,
        marginHorizontal: 10
    },
    markColor:{
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 50,
        width: '40%',
        aspectRatio: 1
    },
    cellView:{
        width: '90%',
        minHeight: SCREEN_SIZE.height * .1,
        borderRadius: 5,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-evenly',
        alignSelf: 'center'
    },
    kmNameWrapper:{
        borderRadius: 5,
        flexGrow: 1
    },
    kmMarkTouchable:{
        flex: .2,
        minHeight: 80,
        marginVertical: 5,
        borderRadius: 5,
        justifyContent: 'space-evenly',
        alignItems: 'center'
    },
    markCircle:{
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 50,
        width: '40%',
        aspectRatio: 1
    },
    markIndicator:{
        width: '20%',
        aspectRatio: 2,
        borderRadius: 5,
        marginVertical:5
    }
})

export default DetailedMarksScreen
