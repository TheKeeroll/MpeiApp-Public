import {createStackNavigator} from "@react-navigation/stack";
import React from "react";
import ScheduleScreen from "./ScheduleScreen";

const Stack = createStackNavigator()


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

export default ScheduleStack
