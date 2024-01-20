import React from "react";
import {createStackNavigator} from "@react-navigation/stack";
import SettingsScreen from "./SettingsScreen";
import GratuitiesScreen from "./GratuitiesScreen";
import WhatsNewScreen from "./WhatsNewScreen";
import DevsScreen from "./DevsScreen";
import TestScreen from "./TestScreen";

const Stack = createStackNavigator()

const SettingsStack: React.FC = ()=>{

    return (
        <Stack.Navigator initialRouteName={'settingsMain'} screenOptions={{headerShown: false}}>
            <Stack.Screen name={'settingsMain'} component={SettingsScreen}/>
            <Stack.Screen name={'gratuities'} component={GratuitiesScreen}/>
            <Stack.Screen name={'whatsNew'} component={WhatsNewScreen}/>
            <Stack.Screen name={'devs'} component={DevsScreen}/>
            {__DEV__ && <Stack.Screen name={'test'} component={TestScreen}/> }
        </Stack.Navigator>
    )
}

export default SettingsStack
