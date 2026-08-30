import {createStackNavigator} from "@react-navigation/stack";
import React from "react";
import ScheduleScreen from "./ScheduleScreen";
import GuestScheduleScreen from "./GuestScheduleScreen";
import type {ScheduleStackParamList} from "./ScheduleNavigation";

const Stack = createStackNavigator<ScheduleStackParamList>()


const ScheduleStack: React.FC = () => {
    return (
        <Stack.Navigator
            initialRouteName={'scheduleMain'}
            screenOptions={{headerShown: false}}
        >
            <Stack.Screen name={'scheduleMain'} component={ScheduleScreen}/>
        </Stack.Navigator>
    )
}

export const GuestScheduleStack: React.FC = () => {
    return (
        <Stack.Navigator
            initialRouteName={'guestScheduleMain'}
            screenOptions={{headerShown: false}}
        >
            <Stack.Screen name={'guestScheduleMain'} component={GuestScheduleScreen}/>
            <Stack.Screen name={'scheduleMain'} component={ScheduleScreen}/>
        </Stack.Navigator>
    )
}

export default ScheduleStack
