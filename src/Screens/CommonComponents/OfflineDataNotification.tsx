import React, {Fragment, useState} from "react";
import {useTheme} from "react-native-paper";
import {LayoutAnimation, StyleSheet, Text, TouchableOpacity} from "react-native";
import {SCREEN_SIZE} from "../../Common/Constants";


const OfflineDataNotification: React.FC = () => {
    const {colors} = useTheme()
    const [hide, setHide] = useState(false)

    return (
        <Fragment>
            {
                hide
                ? null
                : <TouchableOpacity onPress={()=>{
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                        setHide(true)
                }
                    } style={[Styles.main, {backgroundColor: colors.primary}]}>
                    <Text style={{paddingHorizontal: 5, color: colors.text, fontWeight: '700'}}>
                        Проблемы с сетью или на стороне БАРСа. Демонстрируется последняя загруженная версия, данные могли устареть!
                    </Text>
                </TouchableOpacity>
            }
        </Fragment>
    )
}

const Styles = StyleSheet.create({
    main:{
        width: SCREEN_SIZE.width * .8,
        minHeight: 50,
        borderRadius: 20,
        marginTop: 20,
        justifyContent: 'center',
        alignItems: "center"
    }
})



export default OfflineDataNotification
