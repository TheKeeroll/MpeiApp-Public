import React, {Fragment, useState} from "react";
import {
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import {useTheme} from "react-native-paper";
import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import {BARSRecordBookDiscipline, BARSRecordBookSemester} from "../../../API/DataTypes";
import {MarkToColor, withOpacity, CustomTheme} from "../../../Themes/Themes";
import {useSelector} from "react-redux";
import {RootState} from "../../../API/Redux/Store";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import FetchFailed from "../../CommonComponents/FetchFailed";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";
import {useNavigation} from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BARSAPI from "../../../Common/Globals";
import {AD_PLACEMENTS, useAds} from "../../../Ads/AdsProvider";
import StickyBannerSlot from "../../../Ads/StickyBannerSlot";

const DisciplineTypeToText = (type: 'MARK_TEST' | 'NO_MARK_TEST' | 'EXAM') => {
    switch (type){
        case "EXAM": return 'Экзамен'
        case "MARK_TEST": return 'Зачёт с оценкой'
        case "NO_MARK_TEST": return 'Зачёт без оценки'
    }
}

const SemSelector: React.FC<{sems: BARSRecordBookSemester[], selectedIndex: number, onSelect:(index: number)=>void}> =
    (props)=>{
    const {colors} = useTheme<CustomTheme>()
    const {width, fontScale} = useWindowDimensions();
    const selectorHeight = Math.max(48, Math.ceil(40 * Math.min(fontScale, 1.6)));
    const buttonWidth = Math.max(100, width * .25);
    return (
        <View style={{marginVertical: 10, height: selectorHeight, width: '100%'}}>
            <FlatList
                ItemSeparatorComponent={()=><View style={{width: 10}}/>}
                contentContainerStyle={{flexGrow: 1, justifyContent: 'center', paddingHorizontal: 10}}
                horizontal={true} data={props.sems} renderItem={({item,index})=>{
                const selected = props.selectedIndex == index
                return(
                    <TouchableOpacity
                        onPress={props.onSelect.bind(this, index)}
                        style={[Styles.semBtn, {
                            width: buttonWidth,
                            minHeight: selectorHeight,
                            backgroundColor: selected ? colors.highlight : colors.primary,
                        }]}>
                        <Text
                            numberOfLines={2}
                            style={{
                                paddingHorizontal: 8,
                                textAlign: 'center',
                                fontWeight: '600',
                                color: selected ? colors.text : withOpacity(colors.text, 60),
                            }}>
                            {item.name}</Text>
                    </TouchableOpacity>
                )}}/>
        </View>
    )
}

const SemCell: React.FC<{item: BARSRecordBookDiscipline, index: number}> =
    (props) =>{
    const {colors} = useTheme<CustomTheme>()
    const {dark} = useTheme()
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
                        style={[Styles.typeLabel, {color: withOpacity(typeColor, 80)}]}>
                        {_type}
                    </Text>
                    <Text
                        style={[Styles.dateLabel, {color: withOpacity(colors.text, 80)}]}>
                        {props.item.date}
                    </Text>
                </View>
                <View style={Styles.bottomWrapper}>
                    <View style={[Styles.disciplineView, {backgroundColor: colors.surface}]}>
                        <Text
                            style={{padding: 6, width: '100%', color: colors.text, textAlign: 'center'}}>
                            {props.item.name}
                        </Text>
                    </View>
                    <Text
                        style={{marginVertical: 5, paddingHorizontal: 4, color: colors.textUnderline, textAlign: 'center'}}>
                        {props.item.teacher.name}
                    </Text>
                </View>
            </View>
            <View style={Styles.markWrapper}>
                <View style={[Styles.markView,{backgroundColor: MarkToColor(props.item.mark.includes('Перезачет') ? 'Перезачёт' : props.item.mark, dark)}]}>
                    <Text
                        numberOfLines={2}
                        adjustsFontSizeToFit
                        minimumFontScale={0.65}
                        style={{width: '100%', padding: 4, color: colors.text, fontSize: 14, fontWeight: 'bold', textAlign: 'center'}}>
                        {props.item.mark.includes('Перезачет') ? 'Перезачёт' : props.item.mark}
                    </Text>
                </View>
                <Text
                    numberOfLines={1}
                    style={{width: '100%', color: withOpacity(colors.text, 80), fontSize: 12, fontWeight: '600', textAlign: 'center'}}>
                    {props.item.weirdValue}
                </Text>
            </View>
        </View>
    )
}

const RecordBookScreen: React.FC = () => {
    const navigation = useNavigation();
    const {colors} = useTheme()
    const recordBook = useSelector((state: RootState)=>state.RecordBook)
    const insets = useSafeAreaInsets();
    const {getStickyReservedHeight} = useAds();
    const stickyReservedHeight = getStickyReservedHeight(AD_PLACEMENTS.recordBook);
    const contentPaddingBottom = 20 + stickyReservedHeight + insets.bottom;
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
                style={{flex: 1, width: '100%'}}
                contentContainerStyle={{alignItems: 'center', paddingBottom: contentPaddingBottom}}
                ItemSeparatorComponent={()=><View style={{height: 10}}/>}
                data={recordBook.data![semIndex]?.tests??[]}
                renderItem={
                    ({item, index}:{item: BARSRecordBookDiscipline, index: number})=>
                        <SemCell item={item} index={index}/>
                }
                ListHeaderComponent={
                    <Fragment>
                        {offline ? <View style={{alignItems: 'center', marginBottom: 20, justifyContent: 'center'}}>
                            <OfflineDataNotification onRetry={() => { void BARSAPI.RetryDataSection('recordBook') }}/>
                        </View>: null}
                    </Fragment>
                }
            />
        </Fragment>
    )

    const renderSwitch = () => {
        switch (recordBook.status){
            case "LOADING": return <LoadingScreen progressKey={'bars-section:recordBook'} fallbackLabel={'Загрузка зачётной книжки...'}/>
            case "FAILED": return <FetchFailed onRetry={() => { void BARSAPI.RetryDataSection('recordBook') }}/>
            case "OFFLINE":
            case "LOADED": return onLoad(recordBook.status == 'OFFLINE')
        }
    }

    return(
        <Fragment>
            <SafeAreaView edges={['left', 'right', 'bottom']} style={[Styles.main, {backgroundColor: colors.background}]}>
                <DrawerHeader navigation={navigation} title={'Зачётная книжка'}/>
                {renderSwitch()}
                {(recordBook.status === 'OFFLINE' || recordBook.status === 'LOADED') ? (
                    <StickyBannerSlot placement={AD_PLACEMENTS.recordBook}/>
                ) : null}
            </SafeAreaView>
        </Fragment>
    )
}





export default RecordBookScreen


const Styles = StyleSheet.create({
    main:{
        justifyContent: 'flex-start',
        flex: 1,
        alignItems: 'center'
    },
    semCellView:{
        width: '90%',
        flexDirection: 'row',
        alignItems: 'stretch',
        minHeight: 60,
        borderRadius: 5,
    },
    infoWrapper:{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        marginVertical: 5,
        borderRadius: 5
    },
    headView:{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        width: '100%',
        paddingHorizontal: 4,
    },
    typeLabel:{
        flexGrow: 1,
        flexShrink: 1,
        paddingVertical: 3,
        fontWeight: 'bold',
    },
    dateLabel:{
        flexShrink: 0,
        marginLeft: 'auto',
        paddingVertical: 3,
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
        width: '24%',
        minWidth: 72,
        justifyContent: 'space-evenly',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 4,
    },
    markView:{
        width: '100%',
        justifyContent: 'center',
        minHeight: 52,
        alignItems: 'center',
        borderRadius: 5,
    },
    semBtn:{
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 5,
    }
})
