import React, {Fragment} from "react";
import { FlatList, Linking, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import {useTheme} from "react-native-paper";
import { BARSQuestionnaire } from "../../../API/DataTypes";
import { SCREEN_SIZE, URLS } from "../../../Common/Constants";
import {useSelector} from "react-redux";
import {RootState} from "../../../API/Redux/Store";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import {withOpacity} from "../../../Themes/Themes";
import FetchFailed from "../../CommonComponents/FetchFailed";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";
import BARSAPI from "../../../Common/Globals";

const QuestionnaireCell = ({item}: {item: BARSQuestionnaire, index: number}) => {
  const {colors} = useTheme()
  let dates = ''
  let text_color = colors.warning
  if (item.status.includes('завершено')){
    dates = 'Заполнена ' + item.completed
    text_color = colors.accent
  }else if (item.fill_until.length > 1){
    dates = 'Доступна до ' + item.fill_until
  }

  return (
    <View style={[Styles.wrapper, {backgroundColor: colors.surface}]}>
      <View style={Styles.left}>
        <View style={Styles.semText}>
          <Text
            numberOfLines={2}
            style={{ textAlign: 'center', padding: '1%', color: withOpacity(colors.text, 60)}}>
            {item.name}
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
          {item.description}
        </Text>
      </View>
      <Text
        style={{paddingBottom: '1%', paddingLeft: '2%', fontWeight: 'bold', color: withOpacity(text_color, 60)}}>
        {dates}
      </Text>
      {(!item.status.includes('завершено')) &&
        <TouchableOpacity onPress={()=> Linking.openURL(URLS.BARS_QUESTIONNAIRES +  BARSAPI.mCurrentData.student?.id)} style={[{backgroundColor: colors.surface, borderRadius: 15, paddingLeft: '2%', alignItems: 'flex-start', justifyContent: 'space-evenly'}]}>
          <Text adjustsFontSizeToFit style={{color: colors.textUnderline, fontWeight: 'bold'}}>{'Перейти на сайт БАРС'}</Text>
        </TouchableOpacity>
      }
    </View>
  )
}

const QuestionnairesScreen: React.FC<{navigation: any, params: any}> = (props) => {
  const {colors} = useTheme()
  const questionnaires = useSelector((state: RootState)=>state.Questionnaires)


  const onLoad = (offline: boolean) => (
    <FlatList
      style={{width: '100%'}}
      contentContainerStyle={{alignItems: 'center'}}
      data={questionnaires.data!}
      renderItem={({item, index}:{item: BARSQuestionnaire, index: number})=><QuestionnaireCell item={item} index={index}/> }
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
    switch (questionnaires.status){
      case "LOADING": return <LoadingScreen/>
      case "FAILED": return <FetchFailed/>
      case "OFFLINE":
      case "LOADED": return onLoad(questionnaires.status == 'OFFLINE')
    }
  }


  return (
    <Fragment>
      <SafeAreaView style={{flex: 0, backgroundColor: colors.backdrop}}/>
      <SafeAreaView style={[Styles.main,{backgroundColor: colors.background}]}>
        <DrawerHeader {...props} title={'Анкеты'}/>
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

export default QuestionnairesScreen
