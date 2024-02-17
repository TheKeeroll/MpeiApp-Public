import {createStackNavigator} from "@react-navigation/stack";
import React, { useState } from "react";
import ScheduleScreen from "./ScheduleScreen";
import ScheduleScreenLegacy from "./ScheduleScreenLegacy";
import BARSAPI from "../../Common/Globals";
import { DeviceEventEmitter } from "react-native";

const Stack = createStackNavigator()


const ScheduleStack: React.FC = () => {
    const [ isOld, setOld ] = useState(BARSAPI.DesignStyle);

    DeviceEventEmitter.addListener('SET_OLD', (val: boolean)=>{
        console.log("Design set")
        setOld(val)
    })

    return (
        <Stack.Navigator
            initialRouteName={'scheduleMain'}
            screenOptions={{headerShown: false}}
        >
            <Stack.Screen name={'scheduleMain'} component={ isOld ? ScheduleScreenLegacy : ScheduleScreen}/>
        </Stack.Navigator>
    )
}

export default ScheduleStack
