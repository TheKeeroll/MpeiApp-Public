import React, { Fragment, useState } from "react";
import { FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import {useTheme} from "react-native-paper";
import { BARSStipend, BARSStipendPetition } from "../../../API/DataTypes";
import {SCREEN_SIZE} from "../../../Common/Constants";
import {useSelector} from "react-redux";
import {RootState} from "../../../API/Redux/Store";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import {withOpacity} from "../../../Themes/Themes";
import FetchFailed from "../../CommonComponents/FetchFailed";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";
import { convertDate } from "../Marks/BARSMainScreen";

const StipendPageSelector: React.FC<{pages: string[], selectedIndex: number, onSelect:(index: number)=>void}> =
  (props)=>{
    const {colors} = useTheme()
    return (
      <View style={{marginVertical: 10, height: SCREEN_SIZE.height * .05, width: SCREEN_SIZE.width}}>
        <FlatList
          ItemSeparatorComponent={()=><View style={{width: 10}}/>}
          contentContainerStyle={{flexGrow: 1, justifyContent: 'center'}}
          horizontal={true} data={props.pages} renderItem={({item,index})=>{
          const selected = props.selectedIndex == index
          return(
            <TouchableOpacity
              onPress={props.onSelect.bind(this, index)}
              style={[Styles.pageBtn, {backgroundColor: selected? colors.highlight : colors.primary}]}>
              <Text
                style={{fontWeight: '900', color: selected ? colors.text
                    : withOpacity(colors.text, 60)
                }}>
                {item}</Text>
            </TouchableOpacity>
          )}}/>
      </View>
    )
  }

const StipendCell = ({item}: {item: BARSStipend | BARSStipendPetition, index: number}) => {
  const {colors} = useTheme()
  let todayDate= convertDate(new Date().getDDMMYY())

  let stipend_endDate = convertDate(new Date().getDDMMYY())

  let text_color = colors.text

  if ("end_date" in item) {
    stipend_endDate = convertDate(item.end_date);

    if (todayDate <= stipend_endDate) {
      text_color = colors.accent
    }
    return (
      <View style={[Styles.wrapper, { backgroundColor: colors.surface }]}>
        <View style={Styles.left}>
          <View style={Styles.semText}>
            <Text
              numberOfLines={1}
              style={{ textAlign: 'left', padding: '1%', fontWeight: 'bold', color: withOpacity(text_color, 60) }}>
              {item.start_date + ' - ' + item.end_date}
            </Text>
          </View>
          <View style={[Styles.statusText, { backgroundColor: colors.primary }]}>
            <Text
              numberOfLines={2}
              style={{ padding: '1%', fontWeight: 'bold', color: text_color }}>
              {item.amount}
            </Text>
          </View>
        </View>
        <View style={[Styles.typeText, { backgroundColor: colors.primary }]}>
          <Text
            numberOfLines={3}
            style={{ padding: '1%', color: colors.text }}>
            {item.type}
          </Text>
        </View>
        <Text
          style={{ paddingBottom: '1%', paddingLeft: '2%', fontWeight: 'bold', color: withOpacity(text_color, 60) }}>
          {'Приказ №' + item.order_number + ' от ' + item.order_date}
        </Text>
      </View>
    )
  } else {
    return (
      <View style={[Styles.wrapper, { backgroundColor: colors.surface }]}>
        <View style={Styles.left}>
          <View style={Styles.semText}>
            <Text
              numberOfLines={1}
              style={{ textAlign: 'left', padding: '1%', fontWeight: 'bold', color: withOpacity(text_color, 60) }}>
              {item.term}
            </Text>
          </View>
          <View style={[Styles.statusText, { backgroundColor: colors.primary }]}>
            <Text
              numberOfLines={1}
              style={{ padding: '1%', fontWeight: 'bold', color: text_color }}>
              {item.total}
            </Text>
          </View>
        </View>
        <View style={[Styles.typeText, { backgroundColor: colors.primary }]}>
          <Text
            numberOfLines={3}
            style={{ padding: '1%', color: colors.text }}>
            {item.type}
          </Text>
          <View style={Styles.left}>
            <Text
              numberOfLines={1}
              style={{ textAlign: 'left', padding: '1%', color: colors.textUnderline }}>
              {item.wave + ' Волна '}
            </Text>
            <Text
              numberOfLines={1}
              style={{ textAlign: 'right', padding: '1%', color: colors.textUnderline }}>
              {'Ср. балл ПА: ' + item.average_grade}
            </Text>
          </View>
        </View>
        <Text
          style={{ paddingBottom: '1%', paddingLeft: '2%', fontWeight: 'bold', color: withOpacity(text_color, 60) }}>
          {'Подано: ' + item.sub_date + ', расчёт: ' + item.calc_date}
        </Text>
      </View>
    )
  }
}

const StipendsScreen: React.FC<{navigation: any, params: any}> = (props) => {
  const {colors} = useTheme()
  const stipends = useSelector((state: RootState)=>state.Stipends)

  const [stipendPageIndex, setStipendPageIndex] = useState(1 ? 0 : 1)

  const stipend_pages = ['Назначенные', 'Заявления']


  const onLoad = (offline: boolean) => (

    <Fragment>
      <StipendPageSelector
        selectedIndex={stipendPageIndex}
        onSelect={setStipendPageIndex}
        pages={stipend_pages}/>
      {(stipendPageIndex == 0) &&
      <FlatList
        style={{width: '100%'}}
        contentContainerStyle={{alignItems: 'center'}}
        data={stipends.data!.stipends}
        renderItem={({item, index}:{item: BARSStipend, index: number})=><StipendCell item={item} index={index}/> }
        ItemSeparatorComponent={()=><View style={{height: 10}}/>}
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
      }
      {(stipendPageIndex == 1) &&
        <FlatList
          style={{width: '100%'}}
          contentContainerStyle={{alignItems: 'center'}}
          data={stipends.data!.petitions}
          renderItem={({item, index}:{item: BARSStipendPetition, index: number})=><StipendCell item={item} index={index}/> }
          ItemSeparatorComponent={()=><View style={{height: 10}}/>}
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
      }
    </Fragment>
  )

  const renderSwitch = () => {
    switch (stipends.status){
      case "LOADING": return <LoadingScreen/>
      case "FAILED": return <FetchFailed/>
      case "OFFLINE":
      case "LOADED": return onLoad(stipends.status == 'OFFLINE')
    }
  }


  return (
    <Fragment>
      <SafeAreaView style={{flex: 0, backgroundColor: colors.backdrop}}/>
      <SafeAreaView style={[Styles.main,{backgroundColor: colors.background}]}>
        <DrawerHeader {...props} title={'Стипендии'}/>
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
    alignItems: 'flex-start',
    margin: '1%',
    width: '55%',
    justifyContent: 'center'
  },
  statusText:{
    borderRadius: 5,
    margin: '1%',
    width: '33%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  typeText:{
    width: '96%',
    marginBottom: '1%',
    borderRadius: 5,
    alignSelf: 'center'
  },
  pageBtn:{
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
    width: SCREEN_SIZE.width * .45
  }
})

export default StipendsScreen
