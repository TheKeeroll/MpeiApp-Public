import React, {Fragment} from "react";
import {FlatList, StyleSheet, Text, View} from "react-native";

import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import {useTheme} from "react-native-paper";
import { BARSOrder } from "../../../API/DataTypes";
import {SCREEN_SIZE} from "../../../Common/Constants";
import {useSelector} from "react-redux";
import {RootState} from "../../../API/Redux/Store";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import {withOpacity, CustomTheme} from "../../../Themes/Themes";
import FetchFailed from "../../CommonComponents/FetchFailed";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";
import {useNavigation} from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import BARSAPI from "../../../Common/Globals";

const OrderCell = ({item}: {item: BARSOrder, index: number}) => {
  const {colors} = useTheme<CustomTheme>()
  let text_color = colors.textUnderline
  return (
    <View style={[Styles.wrapper, {backgroundColor: colors.surface}]}>
      <View style={Styles.left}>
        <View style={Styles.semText}>
          <Text
            numberOfLines={1}
            style={{ textAlign: 'center', padding: '1%', color: withOpacity(text_color, 60)}}>
            {' '}
          </Text>
        </View>
        <View style={[Styles.statusText, {backgroundColor: colors.primary}]}>
          <Text
            numberOfLines={2}
            style={{padding: '1%', fontWeight: 'bold', color: text_color}}>
            {'№' + item.num}
          </Text>
        </View>
      </View>
      <View style={[Styles.typeText,{backgroundColor: colors.primary}]}>
        <Text
          numberOfLines={3}
          style={{padding: '1%', color: colors.text}}>
          {item.content}
        </Text>
      </View>
      <Text
        style={{paddingBottom: '1%', paddingLeft: '2%', fontWeight: 'bold', color: withOpacity(text_color, 60)}}>
        {item.date}
      </Text>
    </View>
  )
}

const OrdersScreen: React.FC = () => {
  const navigation = useNavigation();
  const {colors} = useTheme()
  const orders = useSelector((state: RootState)=>state.Orders)
  const insets = useSafeAreaInsets();

  const onLoad = (offline: boolean) => (
    <FlatList
      style={{width: '100%'}}
      contentContainerStyle={{alignItems: 'center'}}
      data={orders.data!}
      renderItem={({item, index}:{item: BARSOrder, index: number})=><OrderCell item={item} index={index}/> }
      ItemSeparatorComponent={()=><View style={{height: 20}}/>}
      ListHeaderComponent={
        <Fragment>
          {offline &&
            <View style={{alignItems: 'center', marginTop: 10, justifyContent: 'center'}}>
              <OfflineDataNotification onRetry={() => { void BARSAPI.RetryDataSection('orders') }}/>
            </View>
          }
          <View style={{height: 20}}/>
        </Fragment>
      }
      ListFooterComponent={()=><View style={{height: 20}}/>}
    />
  )

  const renderSwitch = () => {
    switch (orders.status){
      case "LOADING": return <LoadingScreen progressKey={'bars-section:orders'} fallbackLabel={'Загрузка приказов...'}/>
      case "FAILED": return <FetchFailed onRetry={() => { void BARSAPI.RetryDataSection('orders') }}/>
      case "OFFLINE":
      case "LOADED": return onLoad(orders.status == 'OFFLINE')
    }
  }


  return (
    <Fragment>
      <SafeAreaView edges={['left', 'right', 'bottom']} style={[Styles.main,{backgroundColor: colors.background}]}>
        <DrawerHeader navigation={navigation} title={'Приказы'}/>
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

export default OrdersScreen
