import React, { Fragment, useState } from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";

import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import {useTheme} from "react-native-paper";
import { BARSStipend, BARSStipendPetition } from "../../../API/DataTypes";
import {useSelector} from "react-redux";
import {RootState} from "../../../API/Redux/Store";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import {withOpacity, CustomTheme} from "../../../Themes/Themes";
import FetchFailed from "../../CommonComponents/FetchFailed";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";
import { convertDate } from "../Marks/BARSMainScreen";
import {useNavigation} from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BARSAPI from "../../../Common/Globals";
import {AD_PLACEMENTS, useAds} from "../../../Ads/AdsProvider";
import StickyBannerSlot from "../../../Ads/StickyBannerSlot";

const StipendPageSelector: React.FC<{pages: string[], selectedIndex: number, onSelect:(index: number)=>void}> =
  (props)=>{
    const {colors} = useTheme<CustomTheme>()
    const {width, fontScale} = useWindowDimensions();
    const selectorHeight = Math.max(48, Math.ceil(40 * Math.min(fontScale, 1.6)));
    const buttonWidth = Math.max(144, width * .45);
    return (
      <View style={{marginVertical: 10, height: selectorHeight, width: '100%'}}>
        <FlatList
          ItemSeparatorComponent={()=><View style={{width: 10}}/>}
          contentContainerStyle={{flexGrow: 1, justifyContent: 'center', paddingHorizontal: 10}}
          horizontal={true} data={props.pages} renderItem={({item,index})=>{
          const selected = props.selectedIndex == index
          return(
            <TouchableOpacity
              onPress={props.onSelect.bind(this, index)}
              style={[Styles.pageBtn, {
                width: buttonWidth,
                minHeight: selectorHeight,
                backgroundColor: selected ? colors.highlight : colors.primary,
              }]}>
              <Text
                numberOfLines={2}
                style={{
                  paddingHorizontal: 8,
                  textAlign: 'center',
                  fontWeight: '900',
                  color: selected ? colors.text : withOpacity(colors.text, 60),
                }}>
                {item}</Text>
            </TouchableOpacity>
          )}}/>
      </View>
    )
  }

const StipendCell = ({item}: {item: BARSStipend | BARSStipendPetition, index: number}) => {
  const {colors} = useTheme<CustomTheme>()
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
              style={{ textAlign: 'left', padding: '1%', fontWeight: 'bold', color: withOpacity(text_color, 60) }}>
              {item.start_date + ' - ' + item.end_date}
            </Text>
          </View>
          <View style={[Styles.statusText, { backgroundColor: colors.primary }]}>
            <Text
              style={{ padding: '1%', fontWeight: 'bold', color: text_color }}>
              {item.amount}
            </Text>
          </View>
        </View>
        <View style={[Styles.typeText, { backgroundColor: colors.primary }]}>
          <Text
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
              style={{ textAlign: 'left', padding: '1%', fontWeight: 'bold', color: withOpacity(text_color, 60) }}>
              {item.term}
            </Text>
          </View>
          <View style={[Styles.statusText, { backgroundColor: colors.primary }]}>
            <Text
              style={{ padding: '1%', fontWeight: 'bold', color: text_color }}>
              {item.total}
            </Text>
          </View>
        </View>
        <View style={[Styles.typeText, { backgroundColor: colors.primary }]}>
          <Text
            style={{ padding: '1%', color: colors.text }}>
            {item.type}
          </Text>
          <View style={Styles.left}>
            <Text
              style={{flex: 1, textAlign: 'left', padding: '1%', color: colors.textUnderline }}>
              {item.wave + ' Волна '}
            </Text>
            <Text
              style={{flex: 1, textAlign: 'right', padding: '1%', color: colors.textUnderline }}>
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

const StipendsScreen: React.FC = () => {
  const navigation = useNavigation();
  const {colors} = useTheme()
  const stipends = useSelector((state: RootState)=>state.Stipends)

  const [stipendPageIndex, setStipendPageIndex] = useState(1 ? 0 : 1)

  const stipend_pages = ['Назначенные', 'Заявления']
  const insets = useSafeAreaInsets();
  const {getStickyReservedHeight} = useAds();
  const stickyReservedHeight = getStickyReservedHeight(AD_PLACEMENTS.stipends);
  const contentPaddingBottom = 20 + stickyReservedHeight + insets.bottom;

  const onLoad = (offline: boolean) => (

    <Fragment>
      <StipendPageSelector
        selectedIndex={stipendPageIndex}
        onSelect={setStipendPageIndex}
        pages={stipend_pages}/>
      {(stipendPageIndex == 0) &&
      <FlatList
        style={{flex: 1, width: '100%'}}
        contentContainerStyle={{alignItems: 'center', paddingBottom: contentPaddingBottom}}
        data={stipends.data!.stipends}
        renderItem={({item, index}:{item: BARSStipend, index: number})=><StipendCell item={item} index={index}/> }
        ItemSeparatorComponent={()=><View style={{height: 10}}/>}
        ListHeaderComponent={
          <Fragment>
            {offline &&
              <View style={{alignItems: 'center', marginTop: 10, justifyContent: 'center'}}>
                <OfflineDataNotification onRetry={() => { void BARSAPI.RetryDataSection('stipends') }}/>
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
          style={{flex: 1, width: '100%'}}
          contentContainerStyle={{alignItems: 'center', paddingBottom: contentPaddingBottom}}
          data={stipends.data!.petitions}
          renderItem={({item, index}:{item: BARSStipendPetition, index: number})=><StipendCell item={item} index={index}/> }
          ItemSeparatorComponent={()=><View style={{height: 10}}/>}
          ListHeaderComponent={
            <Fragment>
              {offline &&
                <View style={{alignItems: 'center', marginTop: 10, justifyContent: 'center'}}>
                  <OfflineDataNotification onRetry={() => { void BARSAPI.RetryDataSection('stipends') }}/>
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
      case "LOADING": return <LoadingScreen progressKey={'bars-section:stipends'} fallbackLabel={'Загрузка стипендий...'}/>
      case "FAILED": return <FetchFailed onRetry={() => { void BARSAPI.RetryDataSection('stipends') }}/>
      case "OFFLINE":
      case "LOADED": return onLoad(stipends.status == 'OFFLINE')
    }
  }


  return (
    <Fragment>
      <SafeAreaView edges={['left', 'right', 'bottom']} style={[Styles.main,{backgroundColor: colors.background}]}>
        <DrawerHeader navigation={navigation} title={'Стипендии'}/>
        {renderSwitch()}
        {(stipends.status === 'OFFLINE' || stipends.status === 'LOADED') ? (
          <StickyBannerSlot placement={AD_PLACEMENTS.stipends}/>
        ) : null}
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
    width: '95%',
    minHeight: 40,
    borderRadius: 5,
    paddingVertical: 2,
  },
  left:{
    flexDirection: 'row',
    width: '100%',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'space-between',
  },
  semText:{
    alignItems: 'flex-start',
    margin: '1%',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '55%',
    minWidth: 140,
    justifyContent: 'center',
  },
  statusText:{
    borderRadius: 5,
    margin: '1%',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '33%',
    minWidth: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeText:{
    width: '96%',
    marginBottom: '1%',
    borderRadius: 5,
    alignSelf: 'center'
  },
  pageBtn:{
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 5,
  }
})

export default StipendsScreen
