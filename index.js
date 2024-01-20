/**
 * @format
 */
import 'react-native-gesture-handler';
import { AppRegistry, LogBox, Platform, UIManager } from "react-native";
import 'react-native-console-time-polyfill';
import {enableScreens} from "react-native-screens";
import AppEntry from './App';
import {name as appName} from './app.json';
import BARSAPI from "./src/Common/Globals";
import {BarsTask} from "./src/API/BARS";

enableScreens(true)

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

LogBox.ignoreLogs([
  'Require cycle: ', //cheerio кидает варнинг
  'ViewPropTypes will be removed from React Native. Migrate to ViewPropTypes exported from \'deprecated-react-native-prop-types\'.'
]);



BARSAPI.Init(false)
AppRegistry.registerComponent(appName, () => AppEntry);
