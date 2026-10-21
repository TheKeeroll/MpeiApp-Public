import React from 'react';
import {ScrollView, View, useWindowDimensions} from 'react-native';
import {useTheme} from 'react-native-paper';
import {useIsFocused} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {NavigationHeader} from '../CommonComponents/DrawerHeader';
import type {CustomTheme} from '../../Themes/Themes';
import {GRATITUDE_CATEGORIES} from './GratuitiesData';
import {GratitudeSection} from './GratitudeSection';

const GratuitiesScreen: React.FC<{navigation: any; route: any}> = props => {
  const {colors} = useTheme<CustomTheme>();
  const {height} = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const maxSectionHeight = Math.floor(Math.min(height * 0.75, viewportHeight || height * 0.75));

  return (
    <>
      <NavigationHeader {...props} backable title="Благодарности"/>
      <View onLayout={event => setViewportHeight(event.nativeEvent.layout.height)}
        style={{flex: 1, alignItems: 'center', backgroundColor: colors.background}}>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false} style={{width: '90%'}}
          contentContainerStyle={{paddingBottom: Math.max(16, insets.bottom)}}>
          {GRATITUDE_CATEGORIES.map(category => (
            <GratitudeSection key={category.id} category={category} maxHeight={maxSectionHeight} active={focused}/>
          ))}
        </ScrollView>
      </View>
    </>
  );
};

export default GratuitiesScreen;
