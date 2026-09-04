import React, {Fragment, memo, useCallback, useMemo} from "react";
import { FlatList, Linking, StyleSheet, Text, TouchableOpacity, View, ListRenderItem } from "react-native";

import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import {useTheme} from "react-native-paper";
import { BARSQuestionnaire } from "../../../API/DataTypes";
import { SCREEN_SIZE, URLS } from "../../../Common/Constants";
import {useSelector} from "react-redux";
import {RootState} from "../../../API/Redux/Store";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import {withOpacity, CustomTheme} from "../../../Themes/Themes";
import FetchFailed from "../../CommonComponents/FetchFailed";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";
import BARSAPI from "../../../Common/Globals";
import {useNavigation} from "@react-navigation/native";
import { SafeAreaView } from 'react-native-safe-area-context';

const QuestionnaireCell = memo(({item}: {item: BARSQuestionnaire, index: number}) => {
  const {colors} = useTheme<CustomTheme>()

  const {dates, text_color, isCompleted, isExpired} = useMemo(() => {
    let datesValue = ''
    let textColorValue = colors.warning

    const completed = item.status.includes('завершено');
    const expired = item.status.includes('истёк');

    if (completed){
      datesValue = 'Заполнена ' + item.completed
      textColorValue = colors.accent
    } else if (item.fill_until.length > 1){
      datesValue = (expired ? 'Была доступна до ' : 'Доступна до ') + item.fill_until
    }

    if (expired){
      textColorValue = colors.error
    }

    return {
      dates: datesValue,
      text_color: textColorValue,
      isCompleted: completed,
      isExpired: expired
    }
  }, [item.status, item.completed, item.fill_until, colors.warning, colors.accent, colors.error])

  const onNavigateToBars = useCallback(() => {
    Linking.openURL(URLS.BARS_QUESTIONNAIRES + BARSAPI.mCredentials.login)
  }, [])

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
      {(!isCompleted && !isExpired) &&
        <TouchableOpacity onPress={onNavigateToBars} style={[Styles.barsButton, {backgroundColor: colors.surface}]}>
          <Text adjustsFontSizeToFit style={{color: colors.textUnderline, marginBottom: 4, fontWeight: 'bold'}}>{'Перейти на сайт БАРС'}</Text>
        </TouchableOpacity>
      }
    </View>
  )
})

const QuestionnairesScreen: React.FC = () => {
  const navigation = useNavigation();
  const {colors} = useTheme()
  const questionnaires = useSelector((state: RootState)=>state.Questionnaires)

  const renderItem: ListRenderItem<BARSQuestionnaire> = useCallback(({item, index}) => (
    <QuestionnaireCell item={item} index={index}/>
  ), [])

  const keyExtractor = useCallback((item: BARSQuestionnaire) => item.name + item.status, [])

  const ItemSeparator = useCallback(() => <View style={Styles.separator}/>, [])
  const ListFooter = useCallback(() => <View style={Styles.separator}/>, [])

  const ListHeader = useCallback(() => (
    <Fragment>
      {questionnaires.status === 'OFFLINE' &&
        <View style={Styles.offlineNotification}>
          <OfflineDataNotification onRetry={() => { void BARSAPI.RetryDataSection('questionnaires') }}/>
        </View>
      }
      <View style={Styles.separator}/>
    </Fragment>
  ), [questionnaires.status])

  const renderSwitch = () => {
    switch (questionnaires.status){
      case "LOADING": return <LoadingScreen progressKey={'bars-section:questionnaires'} fallbackLabel={'Загрузка анкет...'}/>
      case "FAILED": return <FetchFailed onRetry={() => { void BARSAPI.RetryDataSection('questionnaires') }}/>
      case "OFFLINE":
      case "LOADED": return (
        <FlatList
          style={Styles.list}
          contentContainerStyle={Styles.listContent}
          data={questionnaires.data!}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          ItemSeparatorComponent={ItemSeparator}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={ListFooter}
        />
      )
    }
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[Styles.main,{backgroundColor: colors.background}]}>
      <DrawerHeader navigation={navigation} title={'Анкеты'}/>
      {renderSwitch()}
    </SafeAreaView>
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
  },
  barsButton: {
    borderRadius: 15,
    paddingLeft: '2%',
    alignItems: 'flex-start',
    justifyContent: 'space-evenly'
  },
  separator: {
    height: 20
  },
  offlineNotification: {
    alignItems: 'center',
    marginTop: 10,
    justifyContent: 'center'
  },
  list: {
    width: '100%'
  },
  listContent: {
    alignItems: 'center'
  }
})

export default QuestionnairesScreen
