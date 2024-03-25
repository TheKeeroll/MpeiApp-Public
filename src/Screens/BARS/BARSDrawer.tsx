import {createDrawerNavigator, DrawerContentScrollView} from "@react-navigation/drawer";
import React, {Fragment, useState} from "react";
import BARSMainScreen from "./Marks/BARSMainScreen";
import RecordBookScreen from "./RecordBook/RecordBookScreen";
import ReportsScreen from "./Reports/ReportsScreen";
import SkippedClassesScreen from "./SkippedClasses/SkippedClassesScreen";
import {SafeAreaView, Text, TouchableOpacity, View} from "react-native";
import {
    DrawerActions,
    getFocusedRouteNameFromRoute,
    useNavigation
} from "@react-navigation/native";
import BARSAPI, {CapitalizeFirstChar} from "../../Common/Globals";
import {SCREEN_SIZE} from "../../Common/Constants";
import * as EIcon from 'react-native-vector-icons/Entypo'
import * as ADIcon from 'react-native-vector-icons/AntDesign'
import * as FAIcon from 'react-native-vector-icons/FontAwesome'
import {useTheme} from "react-native-paper";
import {withOpacity} from "../../Themes/Themes";
import Clipboard from '@react-native-clipboard/clipboard';
import QuestionnairesScreen from "./Questionnaires/QuestionnairesScreen";
import TasksScreen from "./Tasks/TasksScreen";
import StipendsScreen from "./Stipends/StipendsScreen";
import OrdersScreen from "./Orders/OrdersScreen";
const Drawer = createDrawerNavigator()

const DrawerHeader: React.FC = () => {
    const student = BARSAPI.CurrentData.student!
    const {colors} = useTheme()
    let study_rating_color = colors.warning
    if (parseFloat(student.study_rating) <= 2.0) {
        study_rating_color = colors.text
    }
    else if (parseFloat(student.study_rating) >= 75.0) {
        study_rating_color = colors.accent
    }
    else if (parseFloat(student.study_rating) < 50.0 ){
        study_rating_color = colors.error
    }
    let complex_rating_color = colors.warning
    if (parseFloat(student.complex_rating) <= 2.0) {
        complex_rating_color = colors.text
    }
    else if (parseFloat(student.complex_rating) >= 40.0) {
        complex_rating_color = colors.accent
    }
    else if (parseFloat(student.complex_rating) < 30.0 ){
        complex_rating_color = colors.error
    }
    let status_color = colors.accent
    if (student.status == "завершил обучение"){
        status_color = '#33FFFF'
    }
    else if (student.status == "временно допущен к обучению"){
        status_color = colors.warning
    }
    else if (student.status == "отчислен"){
        status_color = colors.error
    }

    return (
        <View style={{marginBottom: "10%", width: '90%', alignSelf: 'center', padding: '2.5%', borderRadius: 8, minHeight: SCREEN_SIZE.height * .005, backgroundColor: colors.surface, shadowOpacity: .4, shadowColor: '#00000040', shadowOffset: {height: 2, width: 0}}}>
            <View style={{width: '100%', flexDirection: 'row'}}>
                <View style={{flex: .7}}>
                    <View style={{width: '100%', flexDirection: 'row'}}>
                        <Text
                          numberOfLines={2}
                          style={{fontSize: 16, fontWeight: '600', paddingTop: '1%', paddingLeft: '2%', color: colors.text}}>
                            {student.name + ' ' + student.surname}
                        </Text>
                    </View>
                    <Text onPress={()=>Clipboard.setString(student.indexBook)} style={{fontSize: 12, paddingTop: '1%', paddingLeft: '2%', color: withOpacity(colors.text, 60)}}>{'№ ЗК ' + student.indexBook + ' 🖇️'}</Text>
                    <Text style={{fontSize: 12, paddingTop: '1%', paddingLeft: '2%', color: withOpacity(study_rating_color, 60)}}>{'Учебный рейтинг: ' + student.study_rating}</Text>
                    <Text style={{fontSize: 12, paddingTop: '1%', paddingLeft: '2%', color: withOpacity(complex_rating_color, 60)}}>{'Комплексный рейтинг: ' + student.complex_rating}</Text>
                    <Text style={{fontSize: 12, fontWeight: 'bold', paddingVertical: '1%', paddingLeft: '2%', color: withOpacity(status_color, 60)}}>{CapitalizeFirstChar(student.status)}</Text>
                </View>
                <View style={{flex: .3, alignItems: 'flex-end', justifyContent: 'flex-start'}}>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={{paddingTop: '5%', paddingRight: '4%', color: colors.text}}>{student.group}</Text>
                    <Text adjustsFontSizeToFit numberOfLines={1} style={{ paddingTop: '1%', paddingRight: '4%', color: withOpacity(colors.textUnderline, 60)}}>{CapitalizeFirstChar(student.qualification)}</Text>
                </View>
            </View>
        </View>
    )
}

const DrawerButton: React.FC<{ navigation: any, presserId: number, id: number, onPress:()=>void, title: string, routeName: string, iconComponent: JSX.Element}> = (props) => {
    const isExit = props.routeName == 'exit'
    const isFocused = props.presserId == props.id || isExit && false
    const {colors} = useTheme()
    const navigation = useNavigation()
    const onPress = () => {
        if(isExit){
            BARSAPI.ClearStorage()
        } else {
            if(isFocused){
                props.navigation.closeDrawer()
            }
            navigation.dispatch(DrawerActions.closeDrawer())
            requestAnimationFrame(()=> {
                props.onPress()
                //@ts-ignore
                navigation.navigate(props.routeName)
            })
        }
    }
    return (
        <TouchableOpacity onPress={onPress.bind(this)} style={{alignSelf: 'center', width: '90%', flexDirection: 'row', alignItems: 'center', marginVertical: 5, borderRadius: 8, padding: 8, backgroundColor: isFocused ? colors.highlight : colors.surface, shadowOpacity: .2, shadowColor: '#00000040', shadowOffset: {height: 1, width: 0}}}>
            <View style={{alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: colors.surface, padding: 6}}>
                {props.iconComponent}
            </View>
            <Text style={{ marginLeft: 12, fontWeight: '600', fontSize: 16, color: isFocused ? "#fff" : colors.text }}>{props.title}</Text>
        </TouchableOpacity>
    )
}

const DrawerContent: React.FC<{navigation: any}> = (props)=>{
    const {colors} = useTheme()
    const [pressedId, setPressedId] = useState(0)
    return(
        <Fragment>
            <SafeAreaView style={{flex: 0, backgroundColor: colors.background}}/>
            <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
                <DrawerContentScrollView>
                    <DrawerHeader/>
                    <DrawerButton
                        id={0}
                        presserId={pressedId}
                        onPress={setPressedId.bind(this, 0)}
                        routeName={'barsMainDrawer'} {...props}
                        title={'Оценки'}
                        iconComponent={<EIcon.default name={'bar-graph'} size={18} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                    />
                    <DrawerButton
                        id={1}
                        presserId={pressedId}
                        onPress={setPressedId.bind(this, 1)}
                        routeName={'recordBook'} {...props}
                        title={'Зачётная книжка'}
                        iconComponent={<ADIcon.default name={'book'} size={20} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                    />
                    <DrawerButton
                        id={2}
                        presserId={pressedId}
                        onPress={setPressedId.bind(this, 2)}
                        routeName={'skippedClasses'} {...props}
                        title={'Пропуски'}
                        iconComponent={<FAIcon.default name={'calendar'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                    />
                    <DrawerButton
                      id={3}
                      presserId={pressedId}
                      onPress={setPressedId.bind(this, 3)}
                      routeName={'tasks'} {...props}
                      title={'Задания'}
                      iconComponent={<FAIcon.default name={'tasks'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                    />
                    <DrawerButton
                        id={4}
                        presserId={pressedId}
                        onPress={setPressedId.bind(this, 4)}
                        routeName={'reports'} {...props}
                        title={'Отчёты'}
                        iconComponent={<FAIcon.default name={'file-text'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                    />
                    <DrawerButton
                      id={5}
                      presserId={pressedId}
                      onPress={setPressedId.bind(this, 5)}
                      routeName={'stipends'} {...props}
                      title={'Стипендии'}
                      iconComponent={<FAIcon.default name={'money'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                    />
                    <DrawerButton
                      id={6}
                      presserId={pressedId}
                      onPress={setPressedId.bind(this, 6)}
                      routeName={'orders'} {...props}
                      title={'Приказы'}
                      iconComponent={<FAIcon.default name={'list-alt'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                    />
                    <DrawerButton
                      id={7}
                      presserId={pressedId}
                      onPress={setPressedId.bind(this, 7)}
                      routeName={'questionnaires'} {...props}
                      title={'Анкеты'}
                      iconComponent={<ADIcon.default name={'questioncircleo'} size={25} adjustsFontSizeToFit color={withOpacity(colors.text, 80)}/>}
                    />

                </DrawerContentScrollView>
                <DrawerButton {...props} presserId={-1} id={-2} onPress={()=>{}} title={'Выйти'} routeName={'exit'} iconComponent={
                    <EIcon.default name={'log-out'} color={'#FF8B8B'} adjustsFontSizeToFit size={20}/>
                }/>
            </SafeAreaView>
        </Fragment>
    )
}

const BARSDrawer: React.FC = () => {
    const {colors} = useTheme()
    return (
        <Drawer.Navigator
        useLegacyImplementation={true}
            drawerContent={(props)=><DrawerContent {...props}/>}
            initialRouteName={'barsMainDrawer'}
            screenOptions={{headerTintColor: colors.text, headerShown: false, headerTitleStyle:{color: colors.text}}}
        >
            <Drawer.Screen name={'barsMainDrawer'} component={BARSMainScreen}
                options={({route})=>{
                    const routeName = getFocusedRouteNameFromRoute(route) ?? 'barsMainDrawer'
                    return {
                        swipeEnabled: routeName != 'detailedMarks' && routeName != 'settingsScreen' && routeName != 'settings',
                        headerShown: false
                    }
                }}
            />
            <Drawer.Screen
                name={'recordBook'}
                component={RecordBookScreen}
                options={{
                    title: 'Зачётная книжка'
                }}
            />
            <Drawer.Screen
                name={'reports'}
                component={ReportsScreen}
                options={{
                    title: 'Отчёты'
                }}
            />
            <Drawer.Screen
              name={'questionnaires'}
              component={QuestionnairesScreen}
              options={{
                  title: 'Анкеты'
              }}
            />
            <Drawer.Screen
                name={'skippedClasses'}
                component={SkippedClassesScreen}
                options={{
                    title: 'Пропуски',
                    headerShown: false
                }}
            />
            <Drawer.Screen
              name={'tasks'}
              component={TasksScreen}
              options={{
                  title: 'Задания',
                  headerShown: false
              }}
            />
            <Drawer.Screen
              name={'stipends'}
              component={StipendsScreen}
              options={{
                  title: 'Стипендии',
                  headerShown: false
              }}
            />
            <Drawer.Screen
              name={'orders'}
              component={OrdersScreen}
              options={{
                  title: 'Приказы',
                  headerShown: false
              }}
            />
        </Drawer.Navigator>
    )
}

export default BARSDrawer
