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
                    <ListAvatarItem title={'Гэсэр Петрунин'} link={'https://vk.com/g.petrunin'} image={require('../../../assets/images/Gratitudies/GAS.webp')}/>
                    <ListAvatarItem title={'Александр Ерёмичев'} link={'https://vk.com/micke259'} image={require('../../../assets/images/Gratitudies/San.webp')}/>
                    <ListAvatarItem title={'Сергей Выскиль'} link={'https://vk.com/seeeergey'} image={require('../../../assets/images/Gratitudies/Sergey.webp')}/>
                    <ListAvatarItem title={'Егор Гаврилов'} link={'https://vk.com/nxce16'} image={require('../../../assets/images/Gratitudies/Egor.webp')}/>

                    <ListSeparator title={'Оказали финансовую поддержку'}/>
                    <ListAvatarItem title={'Егор Клишин'} link={'https://vk.com/astralcheak'} image={require('../../../assets/images/Gratitudies/Klishin.webp')}/>
                    <ListAvatarItem title={'Вы тоже можете поддержать проект!'} link={'https://vk.com/dragonsava'} image={require('../../../assets/images/Gratitudies/unknown.webp')}/>

                    <ListSeparator title={'Предоставили аккаунт БАРС'}/>
                    <ListAvatarItem title={'Николай'} link={'https://vk.com/naavdeev'} image={require('../../../assets/images/Gratitudies/Nick.webp')}/>
                    <ListAvatarItem title={'Иван'} link={'https://vk.com/iva_derevo'} image={require('../../../assets/images/Gratitudies/Ivan.webp')}/>
                    <ListAvatarItem title={'Алиса'} link={'https://vk.com/space_cat_1'} image={require('../../../assets/images/Gratitudies/Alisa.webp')}/>
                    <ListAvatarItem title={'Максим'} link={'https://vk.com/m.nistratov'} image={require('../../../assets/images/Gratitudies/Maksim.webp')}/>
                    <ListAvatarItem title={'Анастасия'} link={'https://vk.com/nikelkatalizator'} image={require('../../../assets/images/Gratitudies/Anastasia.webp')}/>
                    <ListAvatarItem title={'Екатерина'} link={'https://vk.com/s_kat27'} image={require('../../../assets/images/Gratitudies/Katya.webp')}/>
                    <ListAvatarItem title={'Степан'} link={'https://vk.com/vvvizg'} image={require('../../../assets/images/Gratitudies/Adam.webp')}/>
                    <ListAvatarItem title={'Александр'} link={'https://vk.com/morbiuse'} image={require('../../../assets/images/Gratitudies/shabanin.webp')}/>
                    <ListAvatarItem title={'Богдан Потапкин'} link={'https://vk.com/bodyapotapkin'} image={require('../../../assets/images/Gratitudies/BogdanPotapkin.webp')}/>
                    <ListAvatarItem title={'Андрей Кошеваров'} link={'https://vk.com/drewshiiiiish'} image={require('../../../assets/images/Gratitudies/AndreyKoshevarov.webp')}/>
                    <ListAvatarItem title={'Лилияна Рожница'} link={'https://vk.com/lovlycherry'} image={require('../../../assets/images/Gratitudies/Lilia.webp')}/>
                    <ListAvatarItem title={'Артём Темнышев'} link={'https://vk.com/begun1ok'} image={require('../../../assets/images/Gratitudies/ArtemTemn.webp')}/>
                    <ListAvatarItem title={'Джалал Гусейнов'} link={'https://vk.com/jjjall'} image={require('../../../assets/images/Gratitudies/jjjall.webp')}/>
                    <ListAvatarItem title={'Сергей Мелихов'} link={'https://vk.com/sergeymelikhov'} image={require('../../../assets/images/Gratitudies/SergeyMelihov.webp')}/>
                    <ListAvatarItem title={'Никита Помогалов'} link={'https://vk.com/disokily'} image={require('../../../assets/images/Gratitudies/NickPomogalov.webp')}/>
                    <ListAvatarItem title={'Вы тоже можете помочь!'} link={'https://vk.com/dragonsava'} image={require('../../../assets/images/Gratitudies/unknown.webp')}/>

                    <ListSeparator title={'Наполнение/уточнение карты'}/>
                    <ListAvatarItem title={'Денис'} link={'https://vk.com/aokich0'} image={require('../../../assets/images/Gratitudies/Den.webp')}/>
                    <ListAvatarItem title={'Анна'} link={'https://vk.com/minina0803'} image={require('../../../assets/images/Gratitudies/Anna.webp')}/>
                    <ListAvatarItem title={'Даниил Подзюбан'} link={'https://vk.com/danko3264'} image={require('../../../assets/images/Gratitudies/DanylPodzuban.webp')}/>
                    <ListAvatarItem title={'Анастасия Карабанова'} link={'https://vk.com/rastvorilas'} image={require('../../../assets/images/Gratitudies/AK.webp')}/>
                    <ListAvatarItem title={'Вы тоже можете помочь с картой!'} link={'https://vk.com/dragonsava'} image={require('../../../assets/images/Gratitudies/unknown.webp')}/>

                    <ListSeparator title={'Дизайн'}/>
                    <ListAvatarItem title={'Максим Крайнов'} link={'https://vk.com/id240979343'} image={require('../../../assets/images/Gratitudies/MaxKryanov.webp')}/>

                    <ListSeparator title={'Альтернативные иконки'}/>
                    <ListAvatarItem title={"Алиса 'Alnijen' Балашова"} link={'https://vk.com/alnijen'} image={require('../../../assets/images/Gratitudies/alnijen.webp')}/>
                    <ListAvatarItem title={'Даниил Шеремет'} link={'https://vk.com/sheremetvideo'} image={require('../../../assets/images/Gratitudies/Sheremet.webp')}/>
                    <ListAvatarItem title={'Вы тоже можете предложить свою иконку!'} link={'https://vk.com/dragonsava'} image={require('../../../assets/images/Gratitudies/unknown.webp')}/>
                    <ListSeparator title={''}/>
                </ScrollView>
            </SafeAreaView>
        </Fragment>
    )
}

export default GratuitiesScreen
