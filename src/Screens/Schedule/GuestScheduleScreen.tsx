import React from 'react';
import {Text, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import {NavigationHeader} from '../CommonComponents/DrawerHeader';
import {withOpacity, type CustomTheme} from '../../Themes/Themes';
import ScheduleSearchPanel from './ScheduleSearchPanel';
import {createScheduleSearchParams} from './ScheduleNavigation';
import InlineBannerAd from '../../Ads/InlineBannerAd';
import {YANDEX_INLINE_AD_PLACEMENTS} from '../../Ads/AdPlacements';

const GuestScheduleScreen: React.FC<{navigation: any}> = ({navigation}) => {
  const {colors} = useTheme<CustomTheme>();
  const [normalizedQuery, setNormalizedQuery] = React.useState('');

  return (
    <View style={{flex: 1, backgroundColor: colors.background}}>
      <NavigationHeader navigation={navigation} title="Расписание"/>
      <View style={{width: '90%', alignSelf: 'center', marginTop: 28}}>
        <Text style={{fontSize: 21, fontWeight: '700', color: colors.text}}>
          Расписание без входа
        </Text>
        <Text style={{marginTop: 8, fontSize: 16, color: withOpacity(colors.text, 78)}}>
          Найдите расписание группы, преподавателя или аудитории. Личные данные БАРС для этого не загружаются.
        </Text>
      </View>
      <ScheduleSearchPanel
        onSearch={query => navigation.push('scheduleMain', createScheduleSearchParams(query))}
        onQueryChange={setNormalizedQuery}
      />
      {!normalizedQuery ? (
        <View style={{width: '90%', alignSelf: 'center'}}>
          <InlineBannerAd placement={YANDEX_INLINE_AD_PLACEMENTS.guestScheduleEmpty}/>
        </View>
      ) : null}
    </View>
  );
};

export default GuestScheduleScreen;
