import React from 'react';
import {ActivityIndicator, Alert, Linking, ScrollView, Text, TouchableOpacity, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from 'react-native-paper';
import BARSAPI from '../../Common/Globals';
import type {CustomTheme} from '../../Themes/Themes';
import AutomaticQuestionnairesSwitch, {ExperimentalBadge, QUESTIONNAIRE_FILL_WARNING} from '../../Questionnaires/AutomaticQuestionnairesSwitch';
import {useMandatoryQuestionnaires} from '../../Questionnaires/useMandatoryQuestionnaires';
import {getQuestionnairesUrl} from '../../Questionnaires/QuestionnaireUrls';

const MandatoryQuestionnairesScreen: React.FC = () => {
  const {colors} = useTheme<CustomTheme>();
  const snapshot = useMandatoryQuestionnaires();
  const busy = snapshot.status !== 'idle';
  const filling = snapshot.status === 'filling';
  React.useEffect(() => { void BARSAPI.PrepareMandatoryQuestionnaires(); }, [snapshot.generation]);
  const manualFill = () => {
    const generation = snapshot.generation;
    Alert.alert('Заполнить обязательные анкеты?', QUESTIONNAIRE_FILL_WARNING, [
      {text: 'Отмена', style: 'cancel'},
      {text: 'Заполнить', onPress: () => {
        if (BARSAPI.MandatoryQuestionnairesSnapshot.generation === generation) void BARSAPI.AutoFillMandatoryQuestionnaires();
      }},
    ]);
  };
  const openWebsite = () => {
    void Linking.openURL(getQuestionnairesUrl(BARSAPI.mCredentials.login)).catch(() => {
      Alert.alert('Не удалось открыть сайт', 'Попробуйте ещё раз или откройте личный кабинет БАРС в браузере.');
    });
  };
  const button = (title: string, onPress: () => void, disabled = false, experimental = false) => (
    <TouchableOpacity accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled} onPress={onPress}
      style={{width: '100%', backgroundColor: colors.primary, borderRadius: 8, padding: 15, opacity: disabled ? 0.45 : 1, gap: 8}}>
      {experimental && <ExperimentalBadge/>}
      <Text style={{color: colors.text, fontSize: 17, textAlign: 'center'}}>{title}</Text>
    </TouchableOpacity>
  );
  return <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
    <ScrollView contentContainerStyle={{padding: 20, paddingBottom: 32, gap: 14, width: '100%', maxWidth: 760, alignSelf: 'center'}}>
      <Text accessibilityRole="header" style={{color: colors.text, fontSize: 25, fontWeight: 'bold'}}>Обязательные анкеты БАРС</Text>
      <Text style={{color: colors.text, fontSize: 17}}>Вход в аккаунт выполнен. БАРС ограничивает доступ к учебным данным, пока вы не заполните обязательные анкеты.</Text>
      {snapshot.questionnaires.map((row, index) => <View key={row.id || `${row.name}:${row.description}:${index}`} style={{backgroundColor: colors.primary, borderRadius: 8, padding: 14, gap: 6}}>
        <Text style={{color: colors.text, fontSize: 17, fontWeight: 'bold'}}>{row.name}</Text>
        {Boolean(row.description) && <Text style={{color: colors.text, fontSize: 15}}>{row.description}</Text>}
      </View>)}
      {snapshot.questionnaires.length === 0 && <Text style={{color: colors.text, fontSize: 16}}>БАРС требует заполнить анкеты. Их названия пока не удалось получить.</Text>}
      {!snapshot.listComplete && snapshot.questionnaires.length > 0 && <Text style={{color: colors.warning, fontSize: 15}}>Список может быть неполным. На сайте БАРС доступны все обязательные анкеты.</Text>}
      {busy && <View accessibilityLiveRegion="polite" style={{gap: 8, alignItems: 'center'}}>
        <ActivityIndicator color={colors.textUnderline}/>
        <Text style={{color: colors.text, fontSize: 16, textAlign: 'center'}}>{snapshot.status === 'loading' ? 'Получаем список анкет…' : snapshot.status === 'checking' ? 'Проверяем доступ…' : 'Заполняем обязательные анкеты…'}</Text>
        {snapshot.progress && <Text style={{color: colors.text, fontSize: 15, textAlign: 'center'}}>Анкета {snapshot.progress.questionnaireIndex} из {snapshot.progress.questionnaireCount}: {snapshot.progress.questionnaireName}{'\n'}Сохранено ответов: {snapshot.progress.answeredQuestions}</Text>}
      </View>}
      {snapshot.error && <Text accessibilityLiveRegion="polite" style={{color: colors.warning, fontSize: 16}}>{snapshot.error}</Text>}
      {button('Перейти на сайт для ручного заполнения', openWebsite)}
      {button(filling ? 'Остановить заполнение' : 'Заполнить анкеты случайными данными автоматически, чтобы восстановить доступ сразу', filling ? () => BARSAPI.CancelQuestionnaireFilling() : manualFill, busy && !filling, true)}
      {button('Проверить снова', () => { void BARSAPI.RetryMandatoryQuestionnaires(); }, busy)}
      <Text style={{color: colors.text, fontSize: 15}}>Браузер использует отдельную сессию и может попросить войти снова. После заполнения вернитесь в приложение и нажмите «Проверить снова».</Text>
      <AutomaticQuestionnairesSwitch/>
      <TouchableOpacity accessibilityRole="button" onPress={() => BARSAPI.Logout()} style={{padding: 12, alignSelf: 'center'}}>
        <Text style={{color: colors.textUnderline, fontSize: 16}}>Выйти из аккаунта</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>;
};
export default MandatoryQuestionnairesScreen;
