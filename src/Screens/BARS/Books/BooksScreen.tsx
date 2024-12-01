import React, {Fragment} from "react";
import {FlatList, SafeAreaView, StyleSheet, Text, View} from "react-native";

import LoadingScreen from "../../LoadingScreen/LoadingScreen";
import {useTheme} from "react-native-paper";
import { BARSBook } from "../../../API/DataTypes";
import {SCREEN_SIZE} from "../../../Common/Constants";
import {useSelector} from "react-redux";
import {RootState} from "../../../API/Redux/Store";
import DrawerHeader from "../../CommonComponents/DrawerHeader";
import {withOpacity} from "../../../Themes/Themes";
import FetchFailed from "../../CommonComponents/FetchFailed";
import OfflineDataNotification from "../../CommonComponents/OfflineDataNotification";
import BARSAPI from "../../../Common/Globals";
import { convertDate } from "../Marks/BARSMainScreen";

const BookCell = ({item}: {item: BARSBook, index: number}) => {
  const {colors} = useTheme()
  let return_date_text = "Сдать до " + item.return_until
  let text_color = colors.text
  try {
    let todayDate= convertDate(new Date().getDDMMYY())
    if (todayDate >= convertDate(item.return_until)) {
      return_date_text = return_date_text + " - просрочено!"
      text_color = colors.error
    } else if (new Date(todayDate.getFullYear(), (todayDate.getDate() + 14) <= 31 ? todayDate.getMonth() : (todayDate.getMonth() + 1), (todayDate.getDate() + 14) <= 31 ? (todayDate.getDate() + 14) : (todayDate.getDate() + 14) - 31) >= convertDate(item.return_until)){
      text_color = colors.warning
    }
  } catch (e:any) {
    console.warn('Books return_date highlighting calculations failed: ' + e.toString());
  }


  return (
    <View style={[Styles.wrapper, {backgroundColor: colors.surface}]}>
      <View style={Styles.left}>
        <View style={Styles.semText}>
          <Text
            numberOfLines={2}
            style={{ textAlign: 'center', padding: '1%', color: withOpacity(colors.text, 60)}}>
            {item.author}
          </Text>
        </View>
        <View style={[Styles.statusText, {backgroundColor: colors.primary}]}>
          <Text
            numberOfLines={2}
            style={{padding: '1%', fontWeight: 'bold', color: colors.textUnderline}}>
            {item.code}
          </Text>
        </View>
      </View>
      <View style={[Styles.typeText,{backgroundColor: colors.primary}]}>
        <Text
          numberOfLines={3}
          style={{padding: '1%', color: colors.text}}>
          {item.name}
        </Text>
      </View>
      <Text
        style={{paddingBottom: '1%', paddingLeft: '2%', fontWeight: 'bold', color: withOpacity(text_color, 60)}}>
        {return_date_text}
      </Text>
    </View>
  )
}

const BooksScreen: React.FC<{navigation: any, params: any}> = (props) => {
  const {colors} = useTheme()
  const booksPack = useSelector((state: RootState)=>state.Books)


  const onLoad = (offline: boolean) => (
    <FlatList
      style={{width: '100%'}}
      contentContainerStyle={{alignItems: 'center'}}
      data={booksPack.data!.books}
      renderItem={({item, index}:{item: BARSBook, index: number})=><BookCell item={item} index={index}/> }
      ItemSeparatorComponent={()=><View style={{height: 20}}/>}
      ListHeaderComponent={()=>
        <View style={{alignItems: 'center', justifyContent: 'center'}}>
          {offline &&
            <View style={{alignItems: 'center', marginTop: 10, justifyContent: 'center'}}>
              <OfflineDataNotification/>
            </View>
          }
          <View style={Styles.libraryCardView}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                Styles.libraryCardViewText,
                {color: colors.text}
              ]}>
              {'Читательский билет ' + booksPack.data?.library_card}
            </Text>
          </View>
        </View>
      }
      ListFooterComponent={()=><View style={{height: 20}}/>}
    />
  )

  const renderSwitch = () => {
    switch (booksPack.status){
      case "LOADING": return <LoadingScreen/>
      case "FAILED": return <FetchFailed/>
      case "OFFLINE":
      case "LOADED": return onLoad(booksPack.status == 'OFFLINE')
    }
  }


  return (
    <Fragment>
      <SafeAreaView style={{flex: 0, backgroundColor: colors.backdrop}}/>
      <SafeAreaView style={[Styles.main,{backgroundColor: colors.background}]}>
        <DrawerHeader {...props} title={'Книги'}/>
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
  libraryCardView:{
    height: 50,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center'
  },
  libraryCardViewText:{
    fontWeight: 'bold',
    fontSize: 20
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

export default BooksScreen
