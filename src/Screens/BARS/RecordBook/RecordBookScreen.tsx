import React, {Fragment, useState} from "react";
import {
    FlatList,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import {SCREEN_SIZE} from "../../../Common/Constants";
import {useTheme} from "react-native-paper";
import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import {BARSRecordBookDiscipline, BARSRecordBookSemester} from "../../../API/DataTypes";
import {MarkToColor, withOpacity} from "../../../Themes/Themes";
import {useSelector} from "react-redux";
import {RootState} from "../../../API/Redux/Store";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import FetchFailed from "../../CommonComponents/FetchFailed";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";

const DisciplineTypeToText = (type: 'MARK_TEST' | 'NO_MARK_TEST' | 'EXAM') => {
    switch (type){
        case "EXAM": return 'Экзамен'
        case "MARK_TEST": return 'Зачёт с оценкой'
        case "NO_MARK_TEST": return 'Зачёт без оценки'
    }
}

const SemSelector: React.FC<{sems: BARSRecordBookSemester[], selectedIndex: number, onSelect:(index: number)=>void}> =
    (props)=>{
    const {colors} = useTheme()
    return (
        <View style={{marginVertical: 10, height: SCREEN_SIZE.height * .05, width: SCREEN_SIZE.width}}>
            <FlatList
                ItemSeparatorComponent={()=><View style={{width: 10}}/>}
                contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}
                horizontal={true} data={props.sems} renderItem={({item,index})=>{
                const selected = props.selectedIndex == index
                return(
                    <TouchableOpacity
                        onPress={props.onSelect.bind(this, index)}
                        style={[Styles.semBtn, {backgroundColor: selected? colors.highlight : colors.primary}]}>
                        <Text
                            style={{fontWeight: '600', color: selected ? colors.text
                                    : withOpacity(colors.text, 60)
                            }}>
                            {item.name}</Text>
                    </TouchableOpacity>
                )}}/>
        </View>
    )
}

const SemCell: React.FC<{item: BARSRecordBookDiscipline, index: number}> =
    (props) =>{
    const {colors, dark} = useTheme()
    let typeColor : string
    let _type = DisciplineTypeToText(props.item.type)
    if (_type.includes('Зачёт без оценки')) typeColor = colors.accent
    else if (_type.includes('Зачёт с оценкой')) typeColor = colors.warning
    else typeColor = colors.error

    return (
        <View style={[Styles.semCellView, {backgroundColor: colors.surface}]}>
            <View style={[Styles.infoWrapper, {backgroundColor: colors.primary}]}>
                <View style={Styles.headView}>
                    <Text
                        style={{padding: '1%', fontWeight: 'bold', color: withOpacity(typeColor, 80), alignSelf: 'flex-start'}}>
                        {_type}
                    </Text>
                    <Text
                        style={{padding: '1%', color: withOpacity(colors.text, 80), alignSelf: 'flex-start'}}>
                        {props.item.date}
                    </Text>
                </View>
                <View style={Styles.bottomWrapper}>
                    <View style={[Styles.disciplineView, {backgroundColor: colors.surface}]}>
                        <Text
                            style={{padding: '1%', width: '100%',  color: colors.text, textAlign: 'center'}}>
                            {props.item.name}
                        </Text>
                    </View>
                    <Text
                        style={{ marginVertical: 5, color: colors.textUnderline, textAlign: 'center'}}>
                        {props.item.teacher.name}
                    </Text>
                </View>
            </View>
            <View style={Styles.markWrapper}>
                <View style={[Styles.markView,{backgroundColor: MarkToColor(props.item.mark.includes('Перезачет') ? 'Перезачёт' : props.item.mark, dark)}]}>
                    <Text
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        style={{ color: colors.text, fontSize: 14, fontWeight: 'bold'}}>
                        {props.item.mark.includes('Перезачет') ? 'Перезачёт' : props.item.mark}
                    </Text>
                </View>
                <Text
                    numberOfLines={1}
                    style={{color: withOpacity(colors.text, 80), fontSize: 12, fontWeight: '600'}}>
                    {props.item.weirdValue}
                </Text>
            </View>
        </View>
    )
}

const RecordBookScreen: React.FC<{navigation: any, params: any}> = (props) => {

    const {colors} = useTheme()
    const recordBook = useSelector((state: RootState)=>state.RecordBook)
    const [semIndex, setSemIndex] =
        useState(recordBook != null ? recordBook.data == null ? 0
            : recordBook.data.length -1 : 0
        )

    const onLoad = (offline: boolean) => (
        <Fragment>
            <SemSelector
                selectedIndex={semIndex}
                onSelect={setSemIndex}
                sems={recordBook.data!}/>
            <FlatList
                style={{width: '100%'}}
                contentContainerStyle={{alignItems: 'center'}}
                ItemSeparatorComponent={()=><View style={{height: 10}}/>}
                data={recordBook.data![semIndex]?.tests??[]}
                renderItem={
                    ({item, index}:{item: BARSRecordBookDiscipline, index: number})=>
                        <SemCell item={item} index={index}/>
                }
                ListHeaderComponent={
                    <Fragment>
                        {offline ? <View style={{alignItems: 'center', marginBottom: 20, justifyContent: 'center'}}>
                            <OfflineDataNotification/>
                        </View>: null}
                    </Fragment>
                }
            />
        </Fragment>
    )

    const renderSwitch = () => {
        switch (recordBook.status){
            case "LOADING": return <LoadingScreen/>
            case "FAILED": return <FetchFailed/>
            case "OFFLINE":
            case "LOADED": return onLoad(recordBook.status == 'OFFLINE')
        }
    }

    return(
        <Fragment>
            <SafeAreaView style={{flex: 0, backgroundColor: colors.backdrop}}/>
            <SafeAreaView style={[Styles.main, {backgroundColor: colors.background}]}>
                <DrawerHeader {...props} title={'Зачётная книжка'}/>
                {renderSwitch()}
            </SafeAreaView>
        </Fragment>
    )
}





export default RecordBookScreen


const Styles = StyleSheet.create({
    main:{
        justifyContent: 'center',
        flex: 1,
        alignItems: 'center'
    },
    semCellView:{
        width: SCREEN_SIZE.width * .9,
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        minHeight: SCREEN_SIZE.height * .05,
        borderRadius: 5,
    },
    infoWrapper:{
        flex: .75,
        alignItems: 'center',
        marginVertical: 5,
        borderRadius: 5
    },
    headView:{
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between'
    },
    bottomWrapper:{
        width: '100%',
        alignItems :'center'
    },
    disciplineView:{
        width: '95%',
        borderRadius:5,
        alignItems: 'center',
        justifyContent :'center'
    },
    markWrapper:{
        flex: .2,
        justifyContent: 'space-evenly',
        alignItems: 'center'
    },
    markView:{
        width: '100%',
        justifyContent: 'center',
        minHeight: SCREEN_SIZE.height * .05,
        alignItems: 'center', borderRadius: 5
    },
    semBtn:{
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 5,
        width: SCREEN_SIZE.width * .25
    }
})
