import {useEffect, useRef} from 'react';
import {AppState, NativeModules, Platform} from 'react-native';
import {useSelector} from 'react-redux';
import type {LoginState} from '../API/BARS';
import type {RootState} from '../API/Redux/Store';
import {createIOSWidgetPublisher, serializeIOSSchedule, type IOSScheduleWidgetBridge} from './IOSScheduleWidget';

export function useIOSScheduleWidgetSync(loginState: LoginState) {
  const schedule = useSelector((state: RootState) => Platform.OS === 'ios' ? state.Schedule : null);
  const publisher = useRef<ReturnType<typeof createIOSWidgetPublisher> | null>(null);
  const missingBridgeReported = useRef(false);
  useEffect(() => {
    if (Platform.OS !== 'ios' || !schedule) return;
    const bridge = NativeModules.ScheduleWidgetBridge as IOSScheduleWidgetBridge | undefined;
    if (!bridge) {
      if (!missingBridgeReported.current) console.warn('iOS schedule widget: native bridge unavailable. Rebuild the iOS app.');
      missingBridgeReported.current = true;
      return;
    }
    publisher.current ??= createIOSWidgetPublisher(bridge);
    const sync = (force = false) => {
      let payload: string | null;
      if (loginState === 'NOT_LOGGED_IN' || loginState === 'STUDENTS_NOT_FOUND') payload = null;
      else if (loginState === 'NOT_INITIATED' || loginState === 'NEED_2FA') return;
      else if (schedule.data) payload = serializeIOSSchedule(schedule.data);
      else if (schedule.status === 'LOADING' && loginState === 'AUTHENTICATED_LOADING_DATA') payload = null;
      else return; // A failed refresh must not erase previously published data.
      void publisher.current?.publish(payload, force).catch(() => {
        console.warn('iOS schedule widget: could not update shared data. Check the App Group and signing.');
      });
    };
    sync();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') sync(true);
    });
    return () => subscription.remove();
  }, [schedule, loginState]);
}
