import React, {Fragment} from "react";
import {Text, TouchableOpacity, View} from "react-native";
import {useTheme} from "react-native-paper";
import {CustomTheme} from "../../Themes/Themes.ts";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type FetchFailedProps = {
    onRetry?: () => void;
    isRetrying?: boolean;
};

const FetchFailed: React.FC<FetchFailedProps> = ({onRetry, isRetrying = false}) => {
    const {colors} = useTheme<CustomTheme>()
    const insets = useSafeAreaInsets();
    return(
        <Fragment>
            <SafeAreaView style={{flex: 1, paddingTop: insets.top, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center'}}>
                <View style={{alignItems: 'center', width: '88%'}}>
                    <Text numberOfLines={2} adjustsFontSizeToFit style={{color: colors.text, fontSize: 20, fontWeight: '700', textAlign: 'center'}}>Не удалось обработать ответ БАРС!</Text>
                    {onRetry ? (
                        <TouchableOpacity
                            disabled={isRetrying}
                            onPress={onRetry}
                            style={{
                                marginTop: 18,
                                minHeight: 44,
                                paddingHorizontal: 20,
                                borderRadius: 10,
                                justifyContent: 'center',
                                backgroundColor: colors.primary,
                                opacity: isRetrying ? 0.55 : 1,
                            }}
                        >
                            <Text style={{color: colors.text, fontWeight: '700'}}>
                                {isRetrying ? 'Повторяем...' : 'Попробовать снова'}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </SafeAreaView>
        </Fragment>
    )
}


export default FetchFailed
