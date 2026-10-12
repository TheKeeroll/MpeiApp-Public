import React from 'react';
import {ActivityIndicator, Alert, Linking, ScrollView, Text, TouchableOpacity, useWindowDimensions, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from 'react-native-paper';
import BARSAPI from '../../Common/Globals';
import type {CustomTheme} from '../../Themes/Themes';
import AutomaticQuestionnairesSwitch, {ExperimentalBadge, QUESTIONNAIRE_FILL_WARNING} from '../../Questionnaires/AutomaticQuestionnairesSwitch';
import {useMandatoryQuestionnaires} from '../../Questionnaires/useMandatoryQuestionnaires';
import {getQuestionnairesUrl} from '../../Questionnaires/QuestionnaireUrls';
import type {MandatoryQuestionnaire} from '../../API/Parsers/MandatoryQuestionnairesParser';
import AuthButton from '../../Login/AuthButton';

const QuestionnaireCard: React.FC<{row: MandatoryQuestionnaire}> = ({row}) => {
  const {colors} = useTheme<CustomTheme>();
  const [expanded, setExpanded] = React.useState(false);
  const title = <Text style={{flex: 1, minWidth: 0, color: colors.text, fontSize: 17, fontWeight: 'bold'}}>{row.name}</Text>;
  return <View style={{backgroundColor: colors.primary, borderRadius: 8}}>
    {row.description ? (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Описание анкеты «${row.name}»`}
        accessibilityState={{expanded}}
        onPress={() => setExpanded(value => !value)}
        style={{flexDirection: 'row', alignItems: 'center', padding: 14, gap: 10}}
      >
        {title}
        <Text accessible={false} style={{color: colors.textUnderline, fontSize: 24}}>{expanded ? '−' : '+'}</Text>
      </TouchableOpacity>
    ) : <Text style={{padding: 14, color: colors.text, fontSize: 17, fontWeight: 'bold'}}>{row.name}</Text>}
    {expanded && Boolean(row.description) && <Text style={{paddingHorizontal: 14, paddingBottom: 14, color: colors.text, fontSize: 15}}>{row.description}</Text>}
  </View>;
};

const MandatoryQuestionnairesScreen: React.FC = () => {
  const {colors} = useTheme<CustomTheme>();
  const {fontScale} = useWindowDimensions();
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
    <AuthButton title={title} disabled={disabled} onPress={onPress}
      style={{width: '100%', minHeight: 50, padding: 15, gap: 8}}>
      {experimental && <ExperimentalBadge/>}
    </AuthButton>
  );
  return <SafeAreaView style={{flex: 1, backgroundColor: colors.background}}>
    {/* Reserve room for the floating balance badge, including font scaling and its balance animation. */}
    <ScrollView contentContainerStyle={{padding: 20, paddingTop: 72 * Math.max(1, fontScale), paddingBottom: 32, gap: 14, width: '100%', maxWidth: 760, alignSelf: 'center'}}>
      <Text accessibilityRole="header" style={{color: colors.text, fontSize: 25, fontWeight: 'bold'}}>Обязательные анкеты БАРС</Text>
      <Text style={{color: colors.text, fontSize: 17}}>Вход в аккаунт выполнен. БАРС ограничивает доступ к учебным данным, пока вы не заполните обязательные анкеты.</Text>
      {snapshot.questionnaires.map((row, index) => <QuestionnaireCard key={`${snapshot.generation}:${row.id || `${row.name}:${row.description}:${index}`}`} row={row}/>)}
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
      {button('Выйти из аккаунта', () => BARSAPI.Logout())}
    </ScrollView>
  </SafeAreaView>;
};
export default MandatoryQuestionnairesScreen;
