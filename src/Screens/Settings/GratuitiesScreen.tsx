import React from "react";
import {Fragment} from "react";
import {useTheme} from "react-native-paper";
import {SafeAreaView, ScrollView} from "react-native";
import {NavigationHeader} from "../CommonComponents/DrawerHeader";
import {ListAvatarItem, ListSeparator} from "./Components";

const GratuitiesScreen: React.FC<{navigation: any, route: any}> = (props)=>{
    const {colors} = useTheme()
    return (
        <Fragment>
            <SafeAreaView style={{flex:0, backgroundColor: colors.backdrop}}/>
            <SafeAreaView style={[{alignItems: 'center', justifyContent: 'center', flex: 1, backgroundColor: colors.background}]}>
                <NavigationHeader {...props} backable title={'Благодарности'}/>
                <ScrollView showsVerticalScrollIndicator={false} style={{width: '90%'}}>

                    <ListSeparator title={'Тестеры версий pre-alpha'}/>
                    <ListAvatarItem title={'Гэсэр Петрунин'} link={'https://vk.com/g.petrunin'} image={require('../../../assets/images/Gratitudies/GAS.png')}/>
                    <ListAvatarItem title={'Александр Ерёмичев'} link={'https://vk.com/micke259'} image={require('../../../assets/images/Gratitudies/San.png')}/>
                    <ListAvatarItem title={'Сергей Выскиль'} link={'https://vk.com/seeeergey'} image={require('../../../assets/images/Gratitudies/Sergey.png')}/>
                    <ListAvatarItem title={'Егор Гаврилов'} link={'https://vk.com/nxce16'} image={require('../../../assets/images/Gratitudies/Egor.jpg')}/>

                    <ListSeparator title={'Предоставили аккаунт БАРС'}/>
                    <ListAvatarItem title={'Николай'} link={'https://vk.com/naavdeev'} image={require('../../../assets/images/Gratitudies/Nick.png')}/>
                    <ListAvatarItem title={'Иван'} link={'https://vk.com/iva_derevo'} image={require('../../../assets/images/Gratitudies/Ivan.png')}/>
                    <ListAvatarItem title={'Алиса'} link={'https://vk.com/space_cat_1'} image={require('../../../assets/images/Gratitudies/Alisa.png')}/>
                    <ListAvatarItem title={'Дарья'} link={'https://vk.com/fraudegirl'} image={require('../../../assets/images/Gratitudies/Dasha.jpg')}/>
                    <ListAvatarItem title={'Максим'} link={'https://vk.com/m.nistratov'} image={require('../../../assets/images/Gratitudies/Maksim.png')}/>
                    <ListAvatarItem title={'Анастасия'} link={'https://vk.com/nikelkatalizator'} image={require('../../../assets/images/Gratitudies/Anastasia.png')}/>
                    <ListAvatarItem title={'Екатерина'} link={'https://vk.com/s_kat27'} image={require('../../../assets/images/Gratitudies/Katya.png')}/>
                    <ListAvatarItem title={'Адам'} link={'https://vk.com/adamborsh'} image={require('../../../assets/images/Gratitudies/Adam.jpg')}/>
                    <ListAvatarItem title={'Александр'} link={'https://vk.com/morbiuse'} image={require('../../../assets/images/Gratitudies/shabanin.png')}/>
                    <ListAvatarItem title={'Богдан Потапкин'} link={'https://vk.com/bodyapotapkin'} image={require('../../../assets/images/Gratitudies/BogdanPotapkin.png')}/>
                    <ListAvatarItem title={'Андрей Кошеваров'} link={'https://vk.com/drewshiiiiish'} image={require('../../../assets/images/Gratitudies/AndreyKoshevarov.png')}/>
                    <ListAvatarItem title={'Вы тоже можете помочь!'} link={'https://vk.com/dragonsava'} image={require('../../../assets/images/Gratitudies/unknown.png')}/>

                    <ListSeparator title={'Наполнение/уточнение карты'}/>
                    <ListAvatarItem title={'Денис'} link={'https://vk.com/aokich0'} image={require('../../../assets/images/Gratitudies/Den.png')}/>
                    <ListAvatarItem title={'Анна'} link={'https://vk.com/minina0803'} image={require('../../../assets/images/Gratitudies/Anna.jpg')}/>
                    <ListAvatarItem title={'Даниил Подзюбан'} link={'https://vk.com/danko3264'} image={require('../../../assets/images/Gratitudies/DanylPodzuban.png')}/>
                    <ListAvatarItem title={'Вы тоже можете помочь с картой!'} link={'https://vk.com/dragonsava'} image={require('../../../assets/images/Gratitudies/unknown.png')}/>

                    <ListSeparator title={'Дизайн'}/>
                    <ListAvatarItem title={'Максим Крайнов'} link={'https://vk.com/id240979343'} image={require('../../../assets/images/Gratitudies/MaxKryanov.png')}/>

                    <ListSeparator title={'Альтернативные иконки'}/>
                    <ListAvatarItem title={"Алиса 'Alnijen' Балашова"} link={'https://vk.com/alnijen'} image={require('../../../assets/images/Gratitudies/alnijen.png')}/>
                    <ListAvatarItem title={'Даниил Шеремет'} link={'https://vk.com/sheremetvideo'} image={require('../../../assets/images/Gratitudies/Sheremet.png')}/>
                    <ListAvatarItem title={'Вы тоже можете предложить свою иконку!'} link={'https://vk.com/dragonsava'} image={require('../../../assets/images/Gratitudies/unknown.png')}/>

                    <ListSeparator title={'Оказали финансовую поддержку'}/>
                    <ListAvatarItem title={'Вы можете стать первым!'} link={'https://vk.com/dragonsava'} image={require('../../../assets/images/Gratitudies/unknown.png')}/>
                    <ListSeparator title={''}/>
                </ScrollView>
            </SafeAreaView>
        </Fragment>
    )
}

export default GratuitiesScreen
