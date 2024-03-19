import BARS from "../API/BARS";
import { Linking } from "react-native";

const BARSAPI = new BARS()
export const cheerio = require('react-native-cheerio')
export const Compare = <T>(a: T, b: T): boolean =>{
    return JSON.stringify(a) == JSON.stringify(b)
}
export default BARSAPI

export const CapitalizeFirstChar = (text: string): string =>  {
    return text.charAt(0).toUpperCase() + text.slice(1)
}

export const openTelegram = () => {
    Linking.openURL('https://t.me/DragonSavA');
}
