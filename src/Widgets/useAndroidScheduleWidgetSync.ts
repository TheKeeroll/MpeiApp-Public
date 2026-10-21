import {useEffect, useRef} from 'react';
import {AppState, NativeModules, Platform} from 'react-native';
import {useSelector} from 'react-redux';
import type {LoginState} from '../API/BARS';
import type {RootState} from '../API/Redux/Store';
import {millisecondsUntilMoscowMidnight} from '../Common/MoscowDate';
import {createScheduleWidgetPublisher, serializeScheduleWidget, type ScheduleWidgetBridge} from './ScheduleWidgetData';

export function useAndroidScheduleWidgetSync(loginState: LoginState) {
  const schedule = useSelector((state: RootState) => Platform.OS === 'android' ? state.Schedule : null);
  const publisher = useRef<ReturnType<typeof createScheduleWidgetPublisher> | null>(null);
  const missingBridgeReported = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'android' || !schedule) return;
    const bridge = NativeModules.SharedStorage as ScheduleWidgetBridge | undefined;
    if (!bridge?.setSchedule || !bridge?.clearSchedule) {
      if (!missingBridgeReported.current) console.warn('Android schedule widget: native bridge unavailable. Rebuild the Android app.');
      missingBridgeReported.current = true;
      return;
    }
    publisher.current ??= createScheduleWidgetPublisher(bridge);
    const sync = (force = false) => {
      let payload: string | null;
      if (loginState === 'NOT_LOGGED_IN' || loginState === 'STUDENTS_NOT_FOUND') payload = null;
      else if (loginState === 'NOT_INITIATED' || loginState === 'NEED_2FA') return;
      else if (schedule.data) payload = serializeScheduleWidget(schedule.data);
      else if (schedule.status === 'LOADING' && loginState === 'AUTHENTICATED_LOADING_DATA') payload = null;
      else return;
      void publisher.current?.publish(payload, force).catch(() => {
        console.warn('Android schedule widget: could not update shared schedule data.');
      });
    };
    let timer: ReturnType<typeof setTimeout>;
    const refresh = (force = false) => {
      clearTimeout(timer);
      sync(force);
      timer = setTimeout(() => refresh(), millisecondsUntilMoscowMidnight() + 25);
    };
    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh(true);
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [schedule, loginState]);
}
