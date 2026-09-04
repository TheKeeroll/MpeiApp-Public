import React, {Fragment, useState} from "react";
import {useTheme} from "react-native-paper";
import {LayoutAnimation, StyleSheet, Text, TouchableOpacity, View} from "react-native";
import {SCREEN_SIZE} from "../../Common/Constants";
import {CustomTheme} from "../../Themes/Themes.ts";


type OfflineDataNotificationProps = {
    onRetry?: () => void;
    isRetrying?: boolean;
};

const OfflineDataNotification: React.FC<OfflineDataNotificationProps> = ({onRetry, isRetrying = false}) => {
    const {colors} = useTheme<CustomTheme>()
    const [hide, setHide] = useState(false)

    return (
        <Fragment>
            {
                hide
                ? null
                : onRetry
                ? (
                    <View style={[Styles.main, {backgroundColor: colors.primary}]}>
                    <Text style={{paddingHorizontal: 5, color: colors.text, fontWeight: '700', textAlign: 'center'}}>
                        Проблемы с сетью или на стороне БАРС. Демонстрируется последняя загруженная версия, данные могли устареть!
                    </Text>
                    <TouchableOpacity
                        disabled={isRetrying}
                        onPress={onRetry}
                        style={{
                            marginTop: 8,
                            marginBottom: 8,
                            minHeight: 34,
                            paddingHorizontal: 14,
                            borderRadius: 8,
                            justifyContent: 'center',
                            backgroundColor: colors.surface,
                            opacity: isRetrying ? 0.55 : 1,
                        }}
                    >
                        <Text style={{color: colors.text, fontWeight: '700'}}>
                            {isRetrying ? 'Повторяем...' : 'Попробовать снова'}
                        </Text>
                    </TouchableOpacity>
                    </View>
                )
                : <TouchableOpacity onPress={()=>{
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
                        setHide(true)
                }
                    } style={[Styles.main, {backgroundColor: colors.primary}]}>
                    <Text style={{paddingHorizontal: 5, color: colors.text, fontWeight: '700'}}>
                        Проблемы с сетью или на стороне БАРС. Демонстрируется последняя загруженная версия, данные могли устареть!
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
