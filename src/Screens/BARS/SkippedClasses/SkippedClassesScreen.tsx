import React, {Fragment, useState} from "react";
import {SkippedClass} from "../../../API/DataTypes";
import {
    FlatList,
    StyleSheet,
    Text,
    View,
    SafeAreaView,
    Platform,
    TouchableOpacity,
    LayoutAnimation
} from "react-native";
import {useTheme} from "react-native-paper";
import {SCREEN_SIZE} from "../../../Common/Constants";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import {useSelector} from "react-redux";
import {RootState} from "../../../API/Redux/Store";
import {LessonIndexToTime} from "../../../API/Parsers/SkippedClassesParser";
import {withOpacity} from "../../../Themes/Themes";
import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import SkippedClassesNotFound from "../../CommonComponents/SkippedClassesNotFound";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";

const Header: React.FC<{hours: number, goodExcuse: number}> = (props) => {
    const {colors} = useTheme()
    return (
        <Fragment>
            <View style={{ justifyContent: 'space-evenly', alignItems: 'center', flexDirection: 'row', marginTop: '5%', minWidth: '70%', height: 40, borderRadius: 10, backgroundColor: props.hours >= 40 ? colors.notification : colors.primary}}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={{fontSize: 14, paddingHorizontal: 2, fontWeight: '700', color: props.hours == 0 ? colors.accent : colors.text}}>{`Всего пропущено часов: ${props.hours} (Пар: ${props.hours / 2})`}</Text>
            </View>
            {props.goodExcuse > 0 &&
            <View style={{ justifyContent: 'space-evenly', alignItems: 'center', flexDirection: 'row', marginTop: '2%', minWidth: '70%', height: 40, borderRadius: 10, backgroundColor: colors.marks["5"]}}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={{fontSize: 14, paddingHorizontal: 2, fontWeight: '700', color: colors.text}}>{`По уважительной причине: ${props.goodExcuse} (Пар: ${props.goodExcuse / 2})`}</Text>
            </View>
            }
        </Fragment>
    )
}

const SkipCard: React.FC<{length: number, item: SkippedClass, index: number}> = (props) => {
    const [showLessonType, setShowLessonType] = useState(false)
    const [showCreatorTime, setShowCreatorTime] = useState(false)
    const [showEditorTime, setShowEditorTime] = useState(false)
    const {colors} = useTheme()
    let lessonTypeColor = colors.warning
    if (props.item.lessonType.includes('Лаб') || props.item.lessonType.includes('Экзамен') || props.item.lessonType.includes('Защита')){
        lessonTypeColor = colors.error
    }
    else if (props.item.lessonType == "Лекция"){
        lessonTypeColor = colors.accent
    }
    if (props.item.lessonType.includes('Практическое')){
        props.item.lessonType = 'Практ. занятие'
    }
    if (props.item.lessonType.includes('Лабораторная')){
        props.item.lessonType = 'Лаб. работа'
    }
    if (props.item.lessonType.includes('Консультации')){
        props.item.lessonType = 'Консул. КП/КР'
    }
    return (
        <View style={{alignItems: 'center', justifyContent: 'space-evenly', minHeight: SCREEN_SIZE.height * .225, marginVertical: SCREEN_SIZE.width * .015, marginLeft: props.index % 3 == 0 ? SCREEN_SIZE.width * .015 : 0, marginRight: SCREEN_SIZE.width * .015, borderRadius: 8,  width: '31.125%', backgroundColor: colors.background}}>
            <Text style={{paddingTop: 2, color: withOpacity(colors.text, 60)}}>{props.item.lessonIndex}</Text>
            <TouchableOpacity onPress={()=>{
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setShowLessonType(p=>!p)
            }} style={{ width: '90%', minHeight: SCREEN_SIZE.height * .04, alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: withOpacity(colors.surface, 60)}}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{width: '100%', textAlign: 'center', color: showLessonType ? lessonTypeColor : colors.text}}>{showLessonType ? props.item.lessonType : LessonIndexToTime(props.item.lessonIndex)}</Text>
            </TouchableOpacity>
            <View style={{width: '90%',  height: SCREEN_SIZE.height * .04, marginTop: 2.5, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: props.item.goodExcuse ? colors.marks["5"] : colors.notification}}>
                <Text style={{ color: colors.text}}>{props.item.date}</Text>
            </View>
            <TouchableOpacity onPress={()=>{
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setShowCreatorTime(p=>!p)
            }} style={{width: '90%', justifyContent: 'space-evenly', minHeight: SCREEN_SIZE.height * .05375, marginTop: 2.5, alignItems: 'center', borderRadius: 5, backgroundColor: withOpacity(colors.surface, 60)}}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 12, paddingVertical: 2, color: withOpacity(colors.text, 60)}}>{showCreatorTime ? props.item.createdBy.time.split(':')[0].length == 1 ? '0' + props.item.createdBy.time : props.item.createdBy.time : 'Создал(-a)'}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ paddingHorizontal: 2, paddingVertical: 2, color: withOpacity(colors.text, 60)}}>{showCreatorTime ? props.item.createdBy.date : props.item.createdBy.name}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>{
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                setShowEditorTime(p=>!p)
            }} style={{width: '90%', justifyContent: 'space-evenly', marginBottom: 2.5, minHeight: SCREEN_SIZE.height * .05375, marginTop: 2.5, alignItems: 'center', borderRadius: 5, backgroundColor: withOpacity(colors.surface, 60)}}>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontSize: 12, paddingVertical: 2, color: withOpacity(colors.text, 60)}}>{showEditorTime ? props.item.lastChangeBy.time.split(':')[0].length == 1 ? '0' + props.item.lastChangeBy.time : props.item.lastChangeBy.time : 'Изменил(-a)'}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit style={{ paddingHorizontal: 2, paddingVertical: 2, color: withOpacity(colors.text, 60)}}>{showEditorTime ? props.item.lastChangeBy.date : props.item.lastChangeBy.name}</Text>
            </TouchableOpacity>
        </View>
    )
}

const Card: React.FC<{expandedCardIndex: number, onExpand:(index: number)=>void, item: SkippedClass[], index: number}> = (props) => {
    const {colors} = useTheme()
    const Collapsed = () => (
        <View style={{width: SCREEN_SIZE.width * .9, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', borderRadius: 5, alignSelf: 'center', height: 50, backgroundColor: colors.surface}}>
            <View style={{height: '80%', flex: .75, marginVertical: 20, justifyContent: 'center', alignItems: 'center', borderRadius: 5, backgroundColor: colors.primary}}>
                <Text numberOfLines={1} style={{textAlign: 'center', width: '80%', color: colors.text}}>{props.item[0].lesson}</Text>
            </View>
            <TouchableOpacity
                style={{height: '90%', alignItems: 'center', justifyContent: 'space-between', flex: .2}}
                onPress={props.onExpand.bind(this, props.index)}
            >
                <Text style={{color: withOpacity(colors.textUnderline, 60), fontWeight: '700'}}>Часов</Text>
                <View style={{flex: .9, width: '100%', borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: props.item.length >= 40 ? withOpacity(colors.notification, 80) : colors.primary}}>
                    <Text style={{ color: withOpacity(colors.text, 60), fontSize: 18, fontWeight: '700'}}>{props.item.length * 2}</Text>
                </View>
            </TouchableOpacity>
        </View>
    )
    const Expanded = () => (
        <View style={{width: SCREEN_SIZE.width * .9, alignItems: 'flex-start', flexDirection: 'column', borderRadius: 5, alignSelf: 'center', minHeight: 90, backgroundColor: colors.surface}}>
            <View style={{flexDirection: 'row', width: '100%', marginTop: '1%', justifyContent: 'space-evenly'}}>
                <View style={{flex: .8, height: 45, alignItems: 'center', justifyContent: 'center'}}>
                    <View style={{width: '95%', height: '85%', alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: props.item.length >= 40 ? withOpacity(colors.notification, 80) : colors.primary}}>
                        <Text numberOfLines={1} style={{color: colors.text, padding: '2%'}}>{props.item[0].lesson}</Text>
                    </View>
                </View>
                <TouchableOpacity
                    style={{flex: .2, height: 45, alignItems: 'center', justifyContent: 'center'}}
                    onPress={props.onExpand.bind(this, props.index)}
                >
                    <Text style={{color: withOpacity(colors.textUnderline, 60), fontWeight: '600'}}>Часов</Text>
                    <View style={{width: '80%', alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: props.item.length >= 40 ? withOpacity(colors.notification, 80) : colors.primary}}>
                        <Text style={{ color: withOpacity(colors.text, 60), fontSize: 18, fontWeight: '700'}}>{props.item.length * 2}</Text>
                    </View>
                </TouchableOpacity>
            </View>
            <View style={{width: '100%'}}>
                <FlatList
                    scrollEnabled={false}
                    style={{width: '100%'}}
                    contentContainerStyle={{alignItems: 'center'}}
                    numColumns={3}
                    data={props.item}
                    renderItem={({item, index}:{item: SkippedClass, index: number})=><SkipCard length={props.item.length} item={item} index={index}/>}
                />
            </View>
        </View>
    )

    return (
        <Fragment>
            {
                props.expandedCardIndex == props.index ? <Expanded/> : <Collapsed/>
            }
        </Fragment>
    )
}

const SkippedClassesScreen: React.FC<{navigation: any, params: any}> = (props) => {
    const raw = useSelector((state: RootState)=> state.SkippedClasses)
    const [expanded, setExpanded] = useState(-1)
    const {colors} = useTheme()


    const onLoad = (offline: boolean) => {
        if(raw.data == null){
            return <SkippedClassesNotFound/>
        }
        let skippedHours = raw.data!.length * 2
        const skippedClassesMap: Map<string, SkippedClass[]> = new Map()
        for(let i of raw.data!){
            if(typeof skippedClassesMap.get(i.lesson) == 'undefined') skippedClassesMap.set(i.lesson, [])
            skippedClassesMap.get(i.lesson)!.push(i)
        }
        const skippedClasses = Array.from(skippedClassesMap, ([, v])=>v)
        let goodExcuseCount = 0
        for(let i of skippedClasses)
            for(let k of i)
                if(k.goodExcuse)
                    goodExcuseCount++
        goodExcuseCount *= 2
        const onExpand = (index: number) => {
            // console.log(index)
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
            setExpanded(p=>p == index ? -1 : index)
        }


        return (
            <View style={{height: Platform.OS == 'android' ? '90%' : '95%', width: '100%', alignItems: 'center'}}>
                <FlatList
                    style={{width: '100%'}}
                    contentContainerStyle={{alignItems: 'center'}}
                    data={skippedClasses}
                    renderItem={({item, index}: {item: SkippedClass[], index: number})=>(
                        <Card expandedCardIndex={expanded} onExpand={onExpand.bind(this)} item={item} index={index}/>
                    )}
                    ItemSeparatorComponent={()=><View style={{height: 20}}/>}
                    ListHeaderComponent={()=>(
                        <Fragment>
                            {offline &&
                                <View style={{alignItems: 'center', marginTop: 10, justifyContent: 'center'}}>
                                    <OfflineDataNotification/>
                                </View>
                            }
                            <Header hours={skippedHours} goodExcuse={goodExcuseCount}/>
                            <View style={{height: 20}}/>
                        </Fragment>
                    )}
                    ListFooterComponent={()=><View style={{height: 20}}/>}
                />
            </View>
        )
    }
    const renderSwitch = () => {
        switch (raw.status) {
            case "OFFLINE":
            case "LOADED": return onLoad(raw.status == 'OFFLINE')
            case "FAILED": return <SkippedClassesNotFound/>
            case "LOADING": return <LoadingScreen/>
        }
    }

    return (
        <Fragment>
            <SafeAreaView style={{flex:0, backgroundColor: colors.backdrop}}/>
            <SafeAreaView style={[Styles.center, {flex: 1, backgroundColor: colors.background}]}>
                <DrawerHeader {...props} title={'Пропуски'}/>
                {renderSwitch()}
            </SafeAreaView>
        </Fragment>
    )

}

const Styles = StyleSheet.create({
    center:{
        alignItems: 'center',
        justifyContent: 'center'
    },
    shadow:{
        //shadowOpacity: .3,
        //shadowOffset:{
        //    height: 4,
        //    width: 2
        //}
    },
    skippedClassCell:{
        width: '90%',
        aspectRatio: 3.5,
        borderRadius: 5,
        flexDirection: 'column'
    },
    skippedClassesCellHeaderWrapper:{
        flex: .2,
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '95%'
    },
    skippedClassesCellHeader:{
        flex: .2,
        height: '100%',
        alignSelf: 'flex-start'
    },
    skippedClassesCellCenter:{
        flex: .7,
        alignItems: 'flex-start',
        justifyContent: 'space-evenly',
        width: '95%',
        borderTopRightRadius: 5,
        borderTopLeftRadius: 5
    },
    skippedClassCellFooter:{
        flex: .35,
        width: '95%',
        borderBottomRightRadius: 5,
        borderBottomLeftRadius: 5
    }
})

export default SkippedClassesScreen
