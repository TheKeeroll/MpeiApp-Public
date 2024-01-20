import React, {Fragment} from "react";
import {FlatList, SafeAreaView, StyleSheet, Text, View} from "react-native";
import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import {useTheme} from "react-native-paper";
import {BARSReport} from "../../../API/DataTypes";
import {SCREEN_SIZE} from "../../../Common/Constants";
import {useSelector} from "react-redux";
import {RootState} from "../../../API/Redux/Store";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import {withOpacity} from "../../../Themes/Themes";
import FetchFailed from "../../CommonComponents/FetchFailed";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";

const ReportCell = ({item}: {item: BARSReport, index: number}) => {
    const {colors} = useTheme()
    let text_color = colors.warning
    if (item.status.includes('завершена')){
        text_color = colors.accent
    }
    return (
        <View style={[Styles.wrapper, {backgroundColor: colors.surface}]}>
            <View style={Styles.left}>
                <View style={Styles.semText}>
                    <Text
                        numberOfLines={2}
                        style={{ textAlign: 'center', padding: '1%', color: withOpacity(colors.text, 60)}}>
                        {item.semester}
                    </Text>
                </View>
                <View style={[Styles.statusText, {backgroundColor: colors.primary}]}>
                    <Text
                        numberOfLines={2}
                        style={{padding: '1%', fontWeight: 'bold', color: text_color}}>
                        {item.status}
                    </Text>
                </View>
            </View>
            <View style={[Styles.typeText,{backgroundColor: colors.primary}]}>
                <Text
                    numberOfLines={3}
                    style={{padding: '1%', color: colors.text}}>
                    {item.binding}
                </Text>
            </View>
            <Text
                style={{paddingBottom: '1%', paddingLeft: '2%', color: withOpacity(colors.text, 60)}}>
                {item.type}
            </Text>
        </View>
    )
}

const ReportsScreen: React.FC<{navigation: any, params: any}> = (props) => {
    const {colors} = useTheme()
    const reports = useSelector((state: RootState)=>state.Reports)


    const onLoad = (offline: boolean) => (
        <FlatList
            style={{width: '100%'}}
            contentContainerStyle={{alignItems: 'center'}}
            data={reports.data!}
            renderItem={({item, index}:{item: BARSReport, index: number})=><ReportCell item={item} index={index}/> }
            ItemSeparatorComponent={()=><View style={{height: 20}}/>}
            ListHeaderComponent={
                <Fragment>
                    {offline &&
                        <View style={{alignItems: 'center', marginTop: 10, justifyContent: 'center'}}>
                            <OfflineDataNotification/>
                        </View>
                    }
                    <View style={{height: 20}}/>
                </Fragment>
            }
            ListFooterComponent={()=><View style={{height: 20}}/>}
        />
    )

    const renderSwitch = () => {
        switch (reports.status){
            case "LOADING": return <LoadingScreen/>
            case "FAILED": return <FetchFailed/>
            case "OFFLINE":
            case "LOADED": return onLoad(reports.status == 'OFFLINE')
        }
    }


    return (
        <Fragment>
            <SafeAreaView style={{flex: 0, backgroundColor: colors.backdrop}}/>
            <SafeAreaView style={[Styles.main,{backgroundColor: colors.background}]}>
                <DrawerHeader {...props} title={'Отчёты'}/>
                {renderSwitch()}
            </SafeAreaView>
        </Fragment>
    )
}

const Styles = StyleSheet.create({
    main:{
        flex: 1,
        alignItems:'center',
        justifyContent: 'flex-start'
    },
    wrapper:{
        width: SCREEN_SIZE.width * .95,
        minHeight: 40,
        borderRadius: 5
    },
    left:{
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'space-between'
    },
    semText:{
        alignItems: 'center',
        margin: '1%',
        width: '40%',
        justifyContent: 'center'
    },
    statusText:{
        borderRadius: 5,
        margin: '1%',
        width: '55%',
        alignItems: 'center',
        justifyContent: 'center'
    },
    typeText:{
        width: '96%',
        marginBottom: '1%',
        borderRadius: 5,
        alignSelf: 'center'
    }
})

export default ReportsScreen
