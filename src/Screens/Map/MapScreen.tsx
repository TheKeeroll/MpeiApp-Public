import React, {createRef, Fragment, useEffect, useState} from "react";
import YaMap, {Marker, MasstransitInfo, Polyline, RouteInfo} from 'react-native-yamap';
import {
    FlatList,
    LayoutAnimation, Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    PermissionsAndroid, SafeAreaView,
} from "react-native";
import { Switch, Title, useTheme } from "react-native-paper";
import {SCREEN_SIZE} from "../../Common/Constants";
import * as FIcon from "react-native-vector-icons/Feather";
import * as FA5Icon from 'react-native-vector-icons/FontAwesome5'
import * as MtIcons from "react-native-vector-icons/MaterialIcons";
import * as IonIcon from 'react-native-vector-icons/Ionicons';
import Geolocation from 'react-native-geolocation-service';
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {withOpacity} from "../../Themes/Themes";
import {ImageSource} from "react-native-vector-icons/Icon";
YaMap.init('083a7d26-4df7-4646-8973-7e7382ba4f7b')

//Ionic school | home | star | fast-food
type PlaceCategory = 'Корпуса'|'Общежития'|'Точки интереса'| 'Еда' | 'Кафедры'

interface Place {
    name: string
    category: PlaceCategory
    lat: number
    lon: number
    howToGet?: string
    uniqueIcon?: string
}

let FROM_LOGIN = false;

const SPECIAL_CATEGORIES: PlaceCategory[]  = ['Кафедры']


const RequestLocationPermission = (onRes:(res: boolean)=>void, onError:(e:any)=>void) => {
    if(Platform.OS == 'ios'){
        Geolocation.requestAuthorization('whenInUse').then((res)=>{
            onRes(res != 'denied' && res != 'disabled')
        }).catch((e)=>onError(e))
    } else {
        PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        ).then((res)=>{
            onRes(res === PermissionsAndroid.RESULTS.GRANTED)
        }).catch((e)=>onError(e))
    }
}
const MapScreen: React.FC<{navigation: any, route: any}> = (props) => {
    const {colors, dark} = useTheme()
    if(Platform.OS == 'android' && Platform.Version < 24) {
        return (<Fragment>
            <SafeAreaView style={{flex: 0, backgroundColor: colors.background}}/>
            <SafeAreaView style={{flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background}}>
                <Title style={{textAlign: 'center', color: colors.text}}>Для функционирования карты необходим Android 7.0 или новее!</Title>
            </SafeAreaView>
        </Fragment>)
    }
    FROM_LOGIN = typeof props.route.params !== 'undefined'
    const [locationAccess, setLocationAccess] = useState<boolean>(false)
    RequestLocationPermission((res)=>setLocationAccess(res),(e)=>{
        console.warn(e)
        setLocationAccess(false)
    })
    const insets = useSafeAreaInsets()
    const [targetPlace, setTargetPlace] = useState<Place | null>(null)
    const [showHowToGet, setShowHowToGet] = useState<boolean>(false)
    const [modalShown, setModalShown] = useState<Place | null>(null)
    const [showRoutes, setShowRoutes] = useState<RouteInfo<MasstransitInfo>[] | null>(null)
    const [routes, setRoutes] = useState<RouteInfo<MasstransitInfo>[]>([])
    const [showPrintRouteBtn, setShowPrintRouteBtn] = useState<boolean>(false)


    const GetCategoryIcon: React.FC<{category: PlaceCategory}> = (props) => {
        const {colors} = useTheme()
        let name = ''
        switch (props.category){
            case "Общежития": name = 'home'; break;
            case "Еда": name = 'fast-food'; break;
            case "Кафедры": name = 'school'; break;
            case "Точки интереса": name = 'star'; break;
        }
        return (
          props.category == 'Корпуса' ?
            <FA5Icon.default name={'school'} color={colors.text} size={25}/>
            :<IonIcon.default name={name} color={colors.text} size={25}/>
        )
    }

    const GetUniqueFoodIcon: ImageSource = (place: Place) => {
        if(place.category != 'Еда') throw new Error('GetUniqueFoodIcon: passed non food')

        const ICONS = {
            "taras": require('../../../assets/images/MapMarkers/Taras_Bulba.png'),
            "rostics": require('../../../assets/images/MapMarkers/Rostics.png'),
            "bbcc": require('../../../assets/images/MapMarkers/Big_Black_Cup_coffee.png'),
            "1&2": require('../../../assets/images/MapMarkers/1&2.png'),
            "manga": require('../../../assets/images/MapMarkers/Manga.png'),
            "harvard": require('../../../assets/images/MapMarkers/Harvard.png'),
            "subway": require('../../../assets/images/MapMarkers/Subway.png'),
            "bk": require('../../../assets/images/MapMarkers/Burger_King.png'),
            "sytpian": require('../../../assets/images/MapMarkers/Feeded_Drinky.png'),
            "dodo": require('../../../assets/images/MapMarkers/Dodo_Pizza.png'),
            "domino": require('../../../assets/images/MapMarkers/Domino.png'),
            "trlefortovo": require('../../../assets/images/MapMarkers/TraktirLefortovo.png'),
            "pubdaddy": require('../../../assets/images/MapMarkers/PubDaddy.png'),
            "olen": require('../../../assets/images/MapMarkers/Tayojny.png'),
            "terem": require('../../../assets/images/MapMarkers/teremok.png'),
            "imonutsa": require('../../../assets/images/MapMarkers/Imonutsa.png'),
            "ilum": require('../../../assets/images/MapMarkers/Illuminator.png'),
            "yakit": require('../../../assets/images/MapMarkers/Yakitoria.png'),
        }
        return typeof place.uniqueIcon != 'undefined' ? (ICONS as any)[place.uniqueIcon] : require('../../../assets/images/MapMarkers/food.png')
    }

    const GetUniqueInterestsIcon: ImageSource = (place: Place) => {
        if(place.category != 'Точки интереса') throw new Error('GetUniqueInterestsIcon: passed non interests')

        const ICONS = {
            "megaphone": require('../../../assets/images/MapMarkers/megafon.png'),
            "mts": require('../../../assets/images/MapMarkers/mts.png'),
            "beeline": require('../../../assets/images/MapMarkers/beeline.png'),
            "sber": require('../../../assets/images/MapMarkers/sber.png'),
            "aviation": require('../../../assets/images/MapMarkers/aviation.png'),
        }
        return typeof place.uniqueIcon != 'undefined' ? (ICONS as any)[place.uniqueIcon] : require('../../../assets/images/MapMarkers/star.png')
    }

    const GetUniqueCorpsIcon: ImageSource = (place: Place) => {
        if(place.category != 'Корпуса') throw new Error('GetUniqueCorpsIcon: passed non corps')

        const ICONS = {
            "gk": require('../../../assets/images/MapMarkers/gk.png'),
            "a": require('../../../assets/images/MapMarkers/a.webp'),
            "e": require('../../../assets/images/MapMarkers/e.png'),
            "jz": require('../../../assets/images/MapMarkers/jz.png'),
            "i": require('../../../assets/images/MapMarkers/i.png'),
            "k": require('../../../assets/images/MapMarkers/k.png'),
            "kl": require('../../../assets/images/MapMarkers/kl.png'),
            "m": require('../../../assets/images/MapMarkers/m.png'),
            "n": require('../../../assets/images/MapMarkers/n.png'),
            "o": require('../../../assets/images/MapMarkers/o.png'),
            "p": require('../../../assets/images/MapMarkers/p.png'),
            "r": require('../../../assets/images/MapMarkers/r.png'),
            "s": require('../../../assets/images/MapMarkers/s.png'),
            "t": require('../../../assets/images/MapMarkers/t.png'),
            "f": require('../../../assets/images/MapMarkers/f.png'),
            "ha": require('../../../assets/images/MapMarkers/ha.png'),
            "ce": require('../../../assets/images/MapMarkers/ce.png'),
            "ch": require('../../../assets/images/MapMarkers/ch.png'),
            "sch": require('../../../assets/images/MapMarkers/sch.png')
        }
        return typeof place.uniqueIcon != 'undefined' ? (ICONS as any)[place.uniqueIcon] : require('../../../assets/images/MapMarkers/school.png')
    }

    const GetPlaceMarker: React.FC<{shown: boolean, place: Place, onPress:(palce: Place)=>void}> = (props) => {
        const GetRequire = () => {
            switch (props.place.category){
                case "Точки интереса": return GetUniqueInterestsIcon(props.place)
                case "Еда": return GetUniqueFoodIcon(props.place)
                case "Общежития": return require('../../../assets/images/MapMarkers/hostel.png')
                case "Корпуса": return GetUniqueCorpsIcon(props.place)
                case "Кафедры": return require('../../../assets/images/MapMarkers/cafedra.png')
            }
        }

        return props.shown ? (
          <Marker
            point={{lat: props.place.lat, lon: props.place.lon}}
            source={GetRequire()}
            onPress={props.onPress.bind(this, props.place)}
            scale={(Platform.OS === 'ios') ? .55 : .30}
          />
        ) : null;
    }

    const DetailPlaceModal: React.FC<{place: Place, show: boolean, onRoute:(place: Place)=> void, onDismiss:()=>void}> = (props) => {
        const {colors} = useTheme()
        return (props.show ?
            <View style={{height: '100%', width: '100%', flexDirection: 'column', justifyContent: 'center', position: 'absolute', top: 0, left: 0, backgroundColor: withOpacity(colors.background, 60)}}>
                <TouchableOpacity onPress={props.onDismiss.bind(this)} style={{flexGrow: 1, width: '100%'}}/>
                <View style={{minHeight: 100, alignItems: 'center', alignSelf:'flex-end', width: '100%', borderTopLeftRadius: 10, borderTopRightRadius: 10, backgroundColor: colors.background}}>
                    <Text numberOfLines={2} style={{padding: 5, color: colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 10}}>{props.place.name}</Text>
                    { (Platform.OS !== 'ios') &&
                      <TouchableOpacity onPress={props.onRoute.bind(this, props.place)} style={{height: 50,justifyContent: 'center', alignItems: 'center', borderRadius: 10, marginVertical: 10, backgroundColor: colors.primary}}>
                          <Text style={{padding: 5, color: colors.text}}>Проложить маршрут</Text>
                      </TouchableOpacity>
                    }

                    {
                      props.place?.howToGet &&
                      <Text numberOfLines={2} adjustsFontSizeToFit style={{padding: 5, color: colors.textUnderline, fontWeight: 'bold', marginBottom: 10}}>{props.place.howToGet}</Text>
                    }
                </View>
            </View>
            : null
        )
    }

    const PLACES: Map<PlaceCategory, Place[]> = new Map();
    (require('./MapPoints.json') as Place[]).forEach(( val)=>{
        if(!PLACES.has(val.category)) {
            PLACES.set(val.category,[])
        }
        PLACES.get(val.category)!.push(val)
    })
    const CATEGORIES: PlaceCategory[] = []
    for(let c of PLACES.keys()){
        CATEGORIES.push(c)
    }


    const GetColorForRouteSelection = (index: number) => {
        const colors = ['#00FF00', '#f7ef02', '#FF0500']
        return colors[index % colors.length];
    }

    const RouteCell: React.FC<{index: number, routeInfo: MasstransitInfo, onPress:(index: number)=>void}> = (props) => {
        const {colors} = useTheme()
        return (
          <TouchableOpacity onPress={()=>{
              console.log('f')
              props.onPress(props.index)
          }} style={{height: 50, minWidth: 50, marginHorizontal: 5,alignItems: 'center', justifyContent: 'center', borderRadius: 5, backgroundColor: colors.primary}}>
              <Text style={{paddingHorizontal: 5, color: colors.text}}>{props.routeInfo.time}</Text>
              <View style={{height: 10, marginTop: 5, aspectRatio: 1, borderRadius: 50, backgroundColor: GetColorForRouteSelection(props.index)}}/>
          </TouchableOpacity>
        )
    }

    const RouteSelector: React.FC<{routes: RouteInfo<MasstransitInfo>[], onRouteSelect:(route: RouteInfo<MasstransitInfo>)=>void}> = (props) =>{
        const inset = useSafeAreaInsets()

        if(!props.routes.length) return null;
        return (
          <FlatList
            horizontal
            contentContainerStyle={{alignItems: 'center', justifyContent: 'center', flexGrow: 1}}
            style={{width: '100%', minHeight: 60, position: 'absolute', top: inset.top, left:0}}
            data={props.routes.map((v)=>v.sections[0].routeInfo)}
            renderItem={({item,index}:{item: MasstransitInfo, index: number})=>
              <RouteCell key={index} index={index} routeInfo={item} onPress={(i)=>{
                  props.onRouteSelect(props.routes[i])
              }}/>}
          />
        )
    }


    const [isShowCategory, setIsShowCategory] = useState({
        'Точки интереса': true,
        'Еда': true,
        'Общежития': true,
        'Корпуса': true,
        'Кафедры': false,
    })


    let map = createRef<YaMap>()



    const Search: React.FC<{onNavigate:(place: Place, special: boolean)=>void}> = (props)=>{
        const {colors} = useTheme()
        const [expanded, setExpanded] = useState(false)
        const [selectedCategory, setSelectedCategory] = useState<PlaceCategory | 'main'>('main')

        const OnNavigateWrap = (place: Place)=>{
            setSelectedCategory('main')
            setExpanded(false)
            props.onNavigate(place, SPECIAL_CATEGORIES.includes(place.category))
        }
        const Collapsed = () => (
          <TouchableOpacity
            onPress={()=>{
                LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                setExpanded(true)
            }}
            style={[Styles.searchCollapsed, { backgroundColor: colors.primary}]}>
              <Text style={{ fontSize: 18, color: colors.text}}>Что ищем ?</Text>
          </TouchableOpacity>
        )
        const Expanded = () => (
          <View
            style={[Styles.searchExpanded, {backgroundColor: colors.surface}]}>
              {
                  <ScrollView style={{marginTop: 5}} contentContainerStyle={{alignItems: 'center'}}>
                      {
                          selectedCategory == 'main' ?
                            CATEGORIES.map((val, key)=><Category key={key} category={val} onPress={setSelectedCategory}/>)
                            : PLACES.get(selectedCategory)!.map((val, key)=><CategoryDetail key={key} place={val} onPress={OnNavigateWrap.bind(this)}/>)
                      }
                  </ScrollView>
              }
              <TouchableOpacity onPress={()=> {
                  if(selectedCategory == 'main'){
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.linear)
                      setExpanded(false)
                  } else {
                      setSelectedCategory('main')
                  }
              }} style={{marginVertical: 10, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', borderRadius: 5, backgroundColor: colors.primary}}>
                  <MtIcons.default size={40} color={colors.text} name={'navigate-before'} adjustsFontSizeToFit/>
                  <Text style={{marginRight: 10, color: colors.text, fontSize: 15}}>{selectedCategory != 'main' ? 'Назад' : 'Свернуть'}</Text>
              </TouchableOpacity>

          </View>
        )


        return (
          <Fragment>
              {expanded ? <Expanded/> : <Collapsed/>}
          </Fragment>
        )
    }

    const Category: React.FC<{category: PlaceCategory, onPress:(category: PlaceCategory)=>void}> = (props) => {
        const {colors} = useTheme()
        const isCategoryVisible = isShowCategory[props.category];
        return (
          <View style={{flexDirection: 'row', maxWidth:SCREEN_SIZE.width * .75}}>
              <TouchableOpacity onPress={()=>{
                  props.onPress(props.category)
                  if(!isCategoryVisible){
                      handleCategoryToggle.bind(this, props.category)}
              }}
                                style={[Styles.category,{backgroundColor: colors.primary}]}>
                  <View style={{height: '100%', flex: .15, alignItems: 'center', justifyContent: 'center'}}>
                      <GetCategoryIcon category={props.category}/>
                  </View>
                  <Text numberOfLines={1} adjustsFontSizeToFit={true} style={[Styles.categoryText, {color: colors.text}]}>{props.category}</Text>
              </TouchableOpacity>
              <Switch
                  value={isCategoryVisible}
                  onValueChange={handleCategoryToggle.bind(this, props.category)}
                  color={Platform.OS == 'ios' ? colors.marks['5'] : colors.text}
                  style={{alignItems: 'center', justifyContent: 'center'}}
              />
          </View>
        )
    }

    const CategoryDetail: React.FC<{place: Place, onPress:(place: Place)=>void}> = (props) => {
        const {colors} = useTheme()
        const {place} = props
        return (
          <TouchableOpacity onPress={props.onPress.bind(this, props.place)} style={[Styles.detailedCategory,{backgroundColor: colors.primary}]}>
              {/*<View style={{height: '100%', flex: .15, backgroundColor: 'green'}}/>*/}
              <Text numberOfLines={2} adjustsFontSizeToFit={true} style={[Styles.categoryText, {flex: 1, color: colors.text}]}>{place.name}</Text>
          </TouchableOpacity>
        )
    }

    const handleCategoryToggle = (category: PlaceCategory) => {
        setIsShowCategory((prevState) => ({
            ...prevState,
            [category]: !prevState[category],
        }));
    }



    const NavigateToPoint = (place: Place, special: boolean) =>{
        setShowPrintRouteBtn(true)
        setTargetPlace(place)
        map.current!.setCenter({lat: place.lat, lon: place.lon}, 15, undefined,undefined, .3)
    }

    const FocusOnUser = () => {
        Geolocation.getCurrentPosition(
            (pos)=>{
                console.log('GOT', pos)
                map.current!.setCenter({lat: pos.coords.latitude, lon: pos.coords.longitude}, 15, undefined,undefined, .3)
            },
            (error)=>{
                console.warn('Failure', error)
            },
            {enableHighAccuracy: true, timeout: 15000, maximumAge: 10000});
    }

    const GetRoutes = (place: Place) => {
        Geolocation.getCurrentPosition((pos)=>{
            map.current!.findPedestrianRoutes([{lat: pos.coords.latitude, lon: pos.coords.longitude},{lat: place.lat, lon: place.lon}],(event)=>{
                setTimeout(() => {
                    console.log("Timeout ended.")
                    setShowRoutes(event.nativeEvent.routes)
                    setRoutes(event.nativeEvent.routes)
                    setModalShown(null)
                    setTargetPlace(place)
                }, 650)

            })
        },(e)=>console.warn(e))
    }


    useEffect(()=>{
        map.current!.fitAllMarkers()
    },[])
    return (
        <Fragment>
        <YaMap
            ref={map}
            nightMode={dark}
            initialRegion={{lat: 55.754706,
                lon: 37.707985,
                zoom: 15,
                azimuth: 80,
                tilt: 100}}
            style={{ flex: 1, width: '100%'}}
        >
            {
                (require('./MapPoints.json') as Place[]).map((val, key)=>(
                    <GetPlaceMarker shown={targetPlace ? val.name == targetPlace.name : isShowCategory[val.category]} place={val} key={key} onPress={(place)=>{
                        if(!locationAccess) return
                        LayoutAnimation.configureNext({
                            duration: 300,
                            create:
                              {
                                  type: LayoutAnimation.Types.easeInEaseOut,
                                  property: LayoutAnimation.Properties.opacity,
                              },
                            update:
                              {
                                  type: LayoutAnimation.Types.easeInEaseOut,
                              }
                        });
                        setModalShown(place)
                    }}/>
                ))
            }
            {
                showRoutes && showRoutes.length && showRoutes.map((route, routeKey)=>route.sections.map((v,k)=>
                    <Polyline
                        key={routeKey * k + k + Math.random()}
                        points={v.points}
                        strokeColor={GetColorForRouteSelection(routeKey)}
                        strokeWidth={5}
                        outlineColor={'#000000'}
                        outlineWidth={5}
                    />
                )).reduce((a,v)=>a.concat(v),[])
            }
        </YaMap>
            {(locationAccess && showRoutes && showRoutes.length || targetPlace)  &&
                <Fragment>
                    <TouchableOpacity onPress={()=>{setTargetPlace(null);setRoutes([]);setShowRoutes(null);setShowHowToGet(false)}}
                                      style={{height: 50, minWidth: '30%', borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', backgroundColor: colors.primary, position: 'absolute', bottom: 60, left: 5}}>
                        <Text style={{padding: 5, color: colors.text, fontSize: 18}}>Отмена</Text>
                    </TouchableOpacity>
                    {targetPlace?.howToGet && showHowToGet &&
                        <View style={{width: '90%', minHeight: 50, borderRadius: 10, position: 'absolute', marginTop: insets.top, alignSelf: 'center', backgroundColor: colors.background}}>
                            <Text numberOfLines={3} adjustsFontSizeToFit style={{padding: 5, fontWeight: 'bold', textAlign: 'center', textAlignVertical: 'center', color: colors.text}}>{targetPlace.howToGet}</Text>
                        </View>
                    }
                </Fragment>
            }
            {FROM_LOGIN &&
                <TouchableOpacity onPress={()=>props.navigation.goBack()}
                    style={{height: 40, width: 90, borderRadius: 5, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', backgroundColor: colors.primary, position: 'absolute', top: insets.top, left: 5}}>
                    <MtIcons.default size={40} color={colors.text} name={'navigate-before'} adjustsFontSizeToFit/>
                    <Text style={{marginRight: 10, color: colors.text, fontSize: 15}}>Назад</Text>
                </TouchableOpacity>
            }
            <Search onNavigate={NavigateToPoint.bind(this)}/>
            <TouchableOpacity disabled={!locationAccess} onPress={FocusOnUser} style={[Styles.focusOnUserBtn, {backgroundColor: colors.primary, opacity: !locationAccess ? .3 : 1}]}>
                <FIcon.default name={'navigation'} size={30} adjustsFontSizeToFit color={colors.text}/>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>{
                map.current!.getCameraPosition((camPos)=>{
                    map.current!.setZoom(++camPos.zoom, .3)
                })
            }} style={[Styles.focusOnUserBtn, {bottom: FROM_LOGIN ? 175 : 170, backgroundColor: colors.primary}]}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={{fontWeight: 'bold', fontSize: 30, color: colors.text}}>+</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={()=>{
                map.current!.getCameraPosition((camPos)=>{
                    map.current!.setZoom(--camPos.zoom, .3)
                })
            }} style={[Styles.focusOnUserBtn, {bottom: FROM_LOGIN ? 125 : 105, backgroundColor: colors.primary}]}>
                <Text adjustsFontSizeToFit numberOfLines={1} style={{fontWeight: 'bold', fontSize: 30, color: colors.text}}>-</Text>
            </TouchableOpacity>
            {modalShown &&
                <DetailPlaceModal
                    place={modalShown}
                    show={!!modalShown}
                    onDismiss={()=>{
                        LayoutAnimation.configureNext({
                            duration: 300,
                            create:
                              {
                                  type: LayoutAnimation.Types.easeInEaseOut,
                                  property: LayoutAnimation.Properties.opacity,
                              },
                            update:
                              {
                                  type: LayoutAnimation.Types.easeInEaseOut,
                              }
                        });
                        setModalShown(null)
                    }}
                    onRoute={(place)=>{
                        console.log('wait...')
                        GetRoutes(place)
                    }}
                />
            }
            {
                routes != [] &&
                <RouteSelector routes={routes} onRouteSelect={(route)=>{
                    setRoutes([])
                    setShowHowToGet(true)
                    setShowRoutes([route])
                    setShowPrintRouteBtn(false)
                }}/>

            }
            {((Platform.OS !== 'ios') && locationAccess && targetPlace && showPrintRouteBtn && !modalShown) &&
                <TouchableOpacity onPress={()=>GetRoutes(targetPlace!)}
                                  style={{height: 50, minWidth: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', backgroundColor: colors.primary, position: 'absolute', bottom: 5, left: SCREEN_SIZE.width * .325}}>
                    <Text style={{padding: 5, color: colors.text, fontSize: 18}}>Проложить маршрут</Text>
                </TouchableOpacity>
            }
        </Fragment>
    )
}

export default MapScreen

const Styles = StyleSheet.create({
    focusOnUserBtn:{
        aspectRatio:1,
        height: 60,
        borderRadius: 10,
        alignItems:'center',
        justifyContent: 'center',
        marginRight: 5,
        bottom: FROM_LOGIN ? 80 : 40,
        right: 0,
        position: 'absolute',
    },
    searchCollapsed:{
        width: '30%',
        height: 50,
        borderRadius: 10,
        alignItems:'center',
        justifyContent: 'center',
        marginLeft: 5,
        marginBottom: 5,
        bottom: FROM_LOGIN ? 80 : 0,
        position: 'absolute',
    },
    searchExpanded:{
        width: '80%',
        height: '70%',
        borderRadius: 10,
        alignItems:'center',
        justifyContent: 'center',
        marginLeft: 5,
        marginBottom: 5,
        bottom: FROM_LOGIN ? 80 : 0,
        position: 'absolute'
    },
    category:{
        width: SCREEN_SIZE.width * .55,
        height: 50,
        backgroundColor: 'red',
        marginVertical: 5,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row'
    },
    detailedCategory:{
        width: SCREEN_SIZE.width * .75,
        height: 50,
        backgroundColor: 'red',
        marginVertical: 5,
        borderRadius: 5,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row'
    },
    categoryText:{
        paddingLeft: 5,
        alignSelf: 'center',
        flex: .85
    }
})
