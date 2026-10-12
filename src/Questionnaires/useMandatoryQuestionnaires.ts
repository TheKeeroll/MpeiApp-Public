import {useSyncExternalStore} from 'react';
import {DeviceEventEmitter} from 'react-native';
import BARSAPI from '../Common/Globals';
import {MANDATORY_QUESTIONNAIRES_EVENT} from './MandatoryQuestionnairesState';

const subscribe = (listener: () => void) => {
  const subscription = DeviceEventEmitter.addListener(MANDATORY_QUESTIONNAIRES_EVENT, listener);
  return () => subscription.remove();
};
const getSnapshot = () => BARSAPI.MandatoryQuestionnairesSnapshot;
export const useMandatoryQuestionnaires = () => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
