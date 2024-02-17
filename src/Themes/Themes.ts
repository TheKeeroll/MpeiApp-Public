import { DefaultTheme } from 'react-native-paper';
import {Font} from "react-native-paper/src/types";
import BARSAPI from "../Common/Globals";

export const withOpacity = (hexColor: string, percent: number)=>{
  percent = percent / 100
  const _opacity = Math.round(Math.min(Math.max(percent || 1, 0), 1) * 255);
  if(hexColor.length == 9){
   return hexColor.slice(0,7) + _opacity.toString(16).toUpperCase()
  }
   return hexColor + _opacity.toString(16).toUpperCase();
}

export const AverageScoreToColor = (ball: string) => {



  const marksColors = BARSAPI.Theme.colors.marks
  const markAsNumber = parseFloat(ball.replace(',','.'))


 if(markAsNumber <= 5 && markAsNumber >= 4.6){
   return marksColors['5']
 } else if(markAsNumber < 4.6 && markAsNumber >= 3.6){
   return marksColors["4"]
 }else if(markAsNumber < 3.6 && markAsNumber >= 2.6){
   return marksColors["3"]
 }else if(markAsNumber < 2.6 && markAsNumber >= 1.6){
   return marksColors["2"]
 }else if(markAsNumber < 1.6 && markAsNumber >= 0.6){
   return marksColors["1"]
 }else if(markAsNumber < 0.6 && markAsNumber >= 0){
   return marksColors["0"]
 }else {
   return marksColors["-"]
 }
}

declare global {
  namespace ReactNativePaper {
    interface ThemeColors {
      switch: string
      marks:{
        '5':        string
        '4':        string
        '3':        string
        '2':        string
        '1':        string
        '0':        string
      },
      highlight:    string,
      textUnderline: string
    }
  }
}

export const THEME_DARK = {
  ...DefaultTheme,
  dark: true,
  roundness: -1,
  colors: {
    primary: '#2B2B2B',
    background: '#000',
    surface: '#393939',
    // accent: '#2B2B2B',
    accent: '#6aa84f',
    warning: '#ffd966',
    error: '#cc0000',
    text: '#f0f0f0',
    onSurface: '#232323',
    disabled: 'red',
    placeholder: 'red',
    backdrop: '#282828',
    notification: '#FF5666',
    // highlight: '#747474',
    highlight: '#8e7cc3',
    textUnderline: '#BB86FC',
    switch: "#4CD964",
    marks:{
      '5':'#03C04AE0',
      '4':'#7BB302',
      '3':'#FFB347',
      '2':'#FF4B4B',
      '1':'#FF0500',
      '0':'#FF0500E0',
      'Перезачёт': '#17a2b8',
      '-':'#737373'
    }
  }
}

export const THEME_LIGHT = {
  ...DefaultTheme,
  dark: false,
  roundness: -1,
  colors: {
    primary: '#F1F1F1',
    background: '#e0e0e0',
    surface: '#FFFFFF',
// accent: 'FEC89A',
    accent: '#6aa84f',
    warning: '#bf9000',
    error: '#cc0000',
    text: '#1A1A1A',
    onSurface: '#9D8189',
    disabled: 'cyan',
    placeholder: 'black',
    backdrop: '#FFFFFF',
    notification: '#E07A5F',
    highlight: '#1E90FF',
    textUnderline: '#5788E7',
    switch: "#4CD964",
    marks:{
      '5':'#94FF92',
      '4':'#BDFF00',
      '3':'#FFE03C',
      '2':'#FF688C',
      '1':'#FF0500',
      '0':'#FF0500',
      'Перезачёт': '#17A2B8',
      '-':'#F1F1F1'
    }
  }
}

export const MarkToColor = (mark: string, dark: boolean) => {

  const clrs = dark ? THEME_DARK.colors.marks : THEME_LIGHT.colors.marks
  switch (mark){
    case 'Отлично':
    case 'Зачтено':
    case '5': return  clrs["5"]
    case 'Хорошо':
    case '4': return  clrs["4"]
    case 'Удовл.':
    case '3': return  clrs["3"]
    case '2': return  clrs["2"]
    case '0': case '1': return clrs["1"]
    case 'Перезачёт': return clrs["Перезачёт"]
    default: return clrs["-"]
  }
}


