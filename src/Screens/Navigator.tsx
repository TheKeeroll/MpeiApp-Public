import React from "react";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import { View, Text } from "react-native";
import * as FIcon from 'react-native-vector-icons/Feather'
import * as MCIcon from 'react-native-vector-icons/MaterialCommunityIcons'
import MapScreen from './Map/MapScreen'
import BARSDrawer from "./BARS/BARSDrawer";
import ScheduleStack from "./Schedule/ScheduleStack";
import {useTheme} from "react-native-paper";
import SettingsStack from "./Settings/SettingsStack";
import inDev from "./CommonComponents/InDev";
import QRCodeScanner from "./QR-Scanner/QRCodeScanner";

const Stack = createBottomTabNavigator()


const Navigator:React.FC = () => {
    const {colors} = useTheme()

    return (
        <Stack.Navigator initialRouteName={'main'} screenOptions={{headerShown: false,
          tabBarStyle:{borderTopWidth: 0, backgroundColor: colors.backdrop}}}
        >
          <Stack.Screen
            name={'map'}
            component={MapScreen}
            options={{
              title: 'Карта',
                tabBarActiveTintColor: colors.textUnderline,
              tabBarIcon: ()=><FIcon.default name={'map-pin'} adjustsFontSizeToFit size={25} style={{color: colors.text}}/>
            }}
          />
          <Stack.Screen
            name={'main'}
            component={BARSDrawer}
            options={{
              title: 'БАРС',
                tabBarActiveTintColor: colors.textUnderline,
              tabBarIcon: ()=>(
              <View style={{flex: 1, alignItems: 'center', justifyContent: 'center'}}>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={{fontWeight: 'bold', fontSize: 250, color: colors.text}}>Б</Text>
              </View>
              )
            }}/>
          <Stack.Screen
            name={'qr'}
            component={QRCodeScanner}
            options={{
              title: 'QR-Сканер',
              tabBarActiveTintColor: colors.textUnderline,
              tabBarIcon: ()=><MCIcon.default name={'qrcode-scan'} adjustsFontSizeToFit size={25} style={{color: colors.text}}/>
            }}
          />
          <Stack.Screen
            name={'schedule'}
            component={ScheduleStack}
            options={{
              title: 'Расписание',
                tabBarActiveTintColor: colors.textUnderline,
              tabBarIcon: ()=><FIcon.default name={'calendar'} adjustsFontSizeToFit size={25} style={{color: colors.text}}/>
            }}
            />
          <Stack.Screen
            name={'other'}
            component={SettingsStack}
            options={{
              title: 'Настройки',
                tabBarActiveTintColor: colors.textUnderline,
              tabBarIcon: ()=><FIcon.default name={'settings'} adjustsFontSizeToFit size={25} style={{color: colors.text}}/>
            }}
          />
        </Stack.Navigator>
    )
}

export default Navigator
