import * as React from 'react';
import {  DeviceEventEmitter } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {NavigationContainer} from "@react-navigation/native";
import BARSAPI from "./src/Common/Globals";
import Navigator from "./src/Screens/Navigator";
import {useState} from "react";
import { LoginState } from "./src/API/BARS";
import {GestureHandlerRootView} from "react-native-gesture-handler";
import { CustomTheme, THEME_DARK, THEME_LIGHT } from "./src/Themes/Themes";
import { Provider as PaperProvider, useTheme } from "react-native-paper";
import LoadingScreen from "./src/Screens/LoadingScreen/LoadingScreen";
import {Provider as ReduxProvider} from 'react-redux'
import {Store} from "./src/API/Redux/Store";
import {} from './src/Extentions/date_e';
import LoginScreenWrapper, { LoginScreenHeader } from "./src/Screens/Login/LoginScreen";
import AF2Screen from "./src/Screens/Login/AF2Screen";
import {AdsProvider} from "./src/Ads/AdsProvider";
import {LoyaltyProvider} from "./src/Loyalty/LoyaltyProvider";
import TokenBalanceBadge from "./src/Loyalty/TokenBalanceBadge";
const App: React.FC = () =>{

  const {colors} = useTheme<CustomTheme>()
  const insets = useSafeAreaInsets();
  const [loggedIn, setLoggedIn] = useState<LoginState>(BARSAPI.LoginState)
  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('LoginState', (state: LoginState)=>{
      setLoggedIn(state)
    })

    setLoggedIn(BARSAPI.LoginState)

    return () => subscription.remove()
  }, [])

  switch (loggedIn){
      case "NOT_LOGGED_IN" : return <LoginScreenWrapper/>
      case "STUDENTS_NOT_FOUND" : return <LoginScreenWrapper/>
      case "NOT_INITIATED": return <LoadingScreen/>
      case "AUTHENTICATED_LOADING_DATA": return <LoadingScreen showStickyAd/>
      case "NEED_2FA": return (
        <SafeAreaView style={{
          flex: 1,
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          alignItems: 'center',
        }}>
          <LoginScreenHeader/>
          <AF2Screen onBack={function(): void {
          console.warn("Need 2FA, going back to login screen");
          BARSAPI.SetLoginState("NOT_LOGGED_IN")
          } }/>
        </SafeAreaView>
      )
      case "LOGGED_IN": return <Navigator/>
  }
}





const AppEntry: React.FC = () => {
    const [theme, setTheme] = useState(BARSAPI.Theme)
    React.useEffect(() => {
      const subscription = DeviceEventEmitter.addListener('SET_THEME', (themeName: string)=>{
        setTheme(themeName == 'dark' ? THEME_DARK : THEME_LIGHT)
        console.log("Current theme: " + themeName)
      })

      return () => subscription.remove()
    }, [])
    return (
        <SafeAreaProvider>
            <NavigationContainer>
                <ReduxProvider store={Store}>
                    <PaperProvider theme={theme}>
                        <GestureHandlerRootView style={{flex:1}}>
                            <LoyaltyProvider>
                                <AdsProvider>
                                    <App/>
                                    <TokenBalanceBadge/>
                                </AdsProvider>
                            </LoyaltyProvider>
                        </GestureHandlerRootView>
                    </PaperProvider>
                </ReduxProvider>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}

export default AppEntry

