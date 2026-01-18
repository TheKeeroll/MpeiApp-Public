import * as React from 'react';
import {  DeviceEventEmitter } from "react-native";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {NavigationContainer} from "@react-navigation/native";
import BARSAPI from "./src/Common/Globals";
import Navigator from "./src/Screens/Navigator";
import {useState} from "react";
import { LoginState } from "./src/API/BARS";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import {THEME_DARK, THEME_LIGHT} from "./src/Themes/Themes";
import {Provider as PaperProvider} from "react-native-paper";
import LoadingScreen from "./src/Screens/LoadingScreen/LoadingScreen";
import {Provider as ReduxProvider} from 'react-redux'
import {Store} from "./src/API/Redux/Store";
import {} from './src/Extentions/date_e';
import LoginScreenWrapper from "./src/Screens/Login/LoginScreen";
import AF2Screen from "./src/Screens/Login/AF2Screen";
const App: React.FC = () =>{

  const [loggedIn, setLoggedIn] = useState<LoginState>('NOT_INITIATED')
  DeviceEventEmitter.addListener('LoginState', (state: LoginState)=>{
      setLoggedIn(state)
  })

  switch (loggedIn){
      case "NOT_LOGGED_IN" : return <LoginScreenWrapper/>
      case "NOT_INITIATED": return <LoadingScreen/>
      case "NEED_2FA": return <AF2Screen onBack={function(): void {
        console.warn("Need 2FA, going back to login screen");
        setLoggedIn(
          "NOT_LOGGED_IN"
        )
      } }/>
      case "LOGGED_IN": return <Navigator/>
  }
}





const AppEntry: React.FC = () => {
    const [theme, setTheme] = useState(BARSAPI.Theme)
    DeviceEventEmitter.addListener('SET_THEME', (themeName: string)=>{
      setTheme(themeName == 'dark' ? THEME_DARK : THEME_LIGHT)
      console.log("Current theme: " + themeName)
    })
    return (
        <SafeAreaProvider>
            <NavigationContainer>
                <ReduxProvider store={Store}>
                    <PaperProvider theme={theme}>
                        <GestureHandlerRootView style={{flex:1}}>
                            <App/>
                        </GestureHandlerRootView>
                    </PaperProvider>
                </ReduxProvider>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}

export default AppEntry

