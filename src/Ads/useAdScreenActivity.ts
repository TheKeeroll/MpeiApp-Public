import React from 'react';
import {AppState} from 'react-native';
import {useIsFocused, useNavigation} from '@react-navigation/native';
import {DrawerStatusContext} from '@react-navigation/drawer';

/** Custom Drawer content stays mounted while closed; screen focus alone is insufficient. */
export const useAdScreenActivity = (surface: 'screen' | 'drawer' = 'screen') => {
  const navigation = useNavigation();
  const focused = useIsFocused();
  const drawerStatus = React.useContext(DrawerStatusContext);
  const [appState, setAppState] = React.useState(AppState.currentState);
  const latest = React.useRef({focused, drawerStatus, appState});
  latest.current = {focused, drawerStatus, appState};

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      latest.current.appState = state;
      setAppState(state);
    });
    return () => subscription.remove();
  }, []);

  const isVisible = focused && (surface === 'drawer' ? drawerStatus === 'open' : drawerStatus !== 'open');
  const isActiveNow = React.useCallback(() => {
    const current = latest.current;
    return current.focused && navigation.isFocused() && current.appState === 'active'
      && (surface === 'drawer' ? current.drawerStatus === 'open' : current.drawerStatus !== 'open');
  }, [navigation, surface]);
  return {isVisible, isActive: isVisible && appState === 'active', isActiveNow};
};
