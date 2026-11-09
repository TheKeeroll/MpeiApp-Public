import React from 'react';
import {AppState, Platform} from 'react-native';
import {useSelector} from 'react-redux';
import type {LoginState} from '../API/BARS';
import type {RootState} from '../API/Redux/Store';
import BARSAPI from '../Common/Globals';
import {useAds} from '../Ads/AdsProvider';
import {checkForAppUpdate, type AppUpdate} from './AppUpdateService';
import AppUpdateModal from './AppUpdateModal';

const currentVersion: string = require('../../package.json').version;

export const isUpdateScreenReady = (loginState: LoginState, marksStatus: string): boolean => (
  loginState === 'NOT_LOGGED_IN' || loginState === 'STUDENTS_NOT_FOUND'
  || (loginState === 'LOGGED_IN' && ['LOADED', 'OFFLINE', 'FAILED'].includes(marksStatus))
);

/** One check after the first usable screen, then once per background → foreground. */
const AppUpdateCheck: React.FC<{loginState: LoginState}> = ({loginState}) => {
  const marksStatus = useSelector((state: RootState) => state.MarkTable.status);
  const ready = isUpdateScreenReady(loginState, marksStatus);
  const {isPrivacyModalVisible} = useAds();
  const [active, setActive] = React.useState(AppState.currentState === 'active');
  const foreground = React.useRef(active);
  const [cycle, setCycle] = React.useState(0);
  const checkedCycle = React.useRef(-1);
  const controller = React.useRef<AbortController | undefined>(undefined);
  const [update, setUpdate] = React.useState<AppUpdate>();
  const [presentationReady, setPresentationReady] = React.useState(false);

  React.useEffect(() => {
    let wasBackground = AppState.currentState === 'background';
    const subscription = AppState.addEventListener('change', state => {
      foreground.current = state === 'active';
      setActive(foreground.current);
      if (state === 'background') {
        wasBackground = true;
        controller.current?.abort();
        setUpdate(undefined);
      } else if (state === 'active' && wasBackground) {
        wasBackground = false;
        setCycle(previous => previous + 1);
      }
    });
    return () => { subscription.remove(); controller.current?.abort(); };
  }, []);

  React.useEffect(() => {
    if (!ready || !active || checkedCycle.current === cycle) return;
    // Two frames let the loaded login/BARS screen paint before starting I/O.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        if (!foreground.current || checkedCycle.current === cycle) return;
        checkedCycle.current = cycle;
        const request = new AbortController();
        controller.current = request;
        try {
          void checkForAppUpdate({
            platform: Platform.OS, currentVersion,
            browserProfile: BARSAPI.GetBARSBrowserProfile(), signal: request.signal,
          }).then(result => { if (!request.signal.aborted) setUpdate(result); }).catch(() => undefined);
        } catch { /* An unavailable browser identity must not affect startup. */ }
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [active, cycle, ready]);

  React.useEffect(() => {
    setPresentationReady(false);
    if (!update || !ready || !active || isPrivacyModalVisible) return;
    // iOS needs time to finish dismissing a preceding native consent sheet.
    const timer = setTimeout(() => setPresentationReady(true), 500);
    return () => clearTimeout(timer);
  }, [active, isPrivacyModalVisible, ready, update]);

  return update && ready && active && !isPrivacyModalVisible && presentationReady
    ? <AppUpdateModal update={update} onLater={() => setUpdate(undefined)}/>
    : null;
};

export default AppUpdateCheck;
