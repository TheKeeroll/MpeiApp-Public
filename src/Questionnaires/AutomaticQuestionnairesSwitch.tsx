import React from 'react';
import {Alert, Switch, Text, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import BARSAPI from '../Common/Globals';
import type {CustomTheme} from '../Themes/Themes';
import {useMandatoryQuestionnaires} from './useMandatoryQuestionnaires';

export const AUTOMATIC_QUESTIONNAIRES_TITLE = 'Автоматически заполнять обязательные анкеты для сохранения доступа в БАРС без подтверждения';
export const QUESTIONNAIRE_FILL_WARNING = 'Приложение отправит ответы в БАРС: предпочтение будет отдано нейтральным вариантам («Затрудняюсь ответить», «не знаю», «не знал(а)», «Нет»), а при их отсутствии — случайным. Текстовые поля получат случайные заглушки. Эти ответы могут не отражать ваше мнение. Функция экспериментальная; уже отправленные ответы не откатываются.';

export const ExperimentalBadge: React.FC = () => {
  const {colors} = useTheme<CustomTheme>();
  return <View style={{alignSelf: 'flex-start', maxWidth: '100%', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: colors.warning}}>
    <Text numberOfLines={1} adjustsFontSizeToFit style={{color: colors.warning, fontSize: 12}}>Экспериментально</Text>
  </View>;
};

const AutomaticQuestionnairesSwitch: React.FC = () => {
  const {colors} = useTheme<CustomTheme>();
  const {enabled} = useMandatoryQuestionnaires();
  const confirmationOpen = React.useRef(false);
  const toggle = (value: boolean) => {
    if (!value) { BARSAPI.SetAutomaticQuestionnaireFilling(false); return; }
    if (confirmationOpen.current) return;
    confirmationOpen.current = true;
    const cancel = () => { confirmationOpen.current = false; BARSAPI.SetAutomaticQuestionnaireFilling(false); };
    Alert.alert('Экспериментальное автозаполнение', `${QUESTIONNAIRE_FILL_WARNING}\n\nПри включении обязательные анкеты будут заполняться без дальнейшего подтверждения.`, [
      {text: 'Отмена', style: 'cancel', onPress: cancel},
      {text: 'Включить', onPress: () => { confirmationOpen.current = false; BARSAPI.SetAutomaticQuestionnaireFilling(true); }},
    ], {cancelable: true, onDismiss: cancel});
  };
  return <View style={{flexDirection: 'row', alignItems: 'center', width: '100%', borderRadius: 5, backgroundColor: colors.primary, padding: 12, marginTop: 10, gap: 10}}>
    <View style={{flex: 1, minWidth: 0, gap: 7}}>
      <ExperimentalBadge/>
      <Text style={{color: colors.text, fontSize: 16}}>{AUTOMATIC_QUESTIONNAIRES_TITLE}</Text>
    </View>
    <Switch accessibilityLabel={AUTOMATIC_QUESTIONNAIRES_TITLE} value={enabled} onValueChange={toggle}
      trackColor={{true: colors.textUnderline}} style={{flexShrink: 0}}/>
  </View>;
};
export default AutomaticQuestionnairesSwitch;
