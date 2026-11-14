import {useSyncExternalStore} from 'react';
import {createMMKV} from 'react-native-mmkv';
import {ScheduleSearchLibrary} from './ScheduleSearchLibrary';

let library: ScheduleSearchLibrary | undefined;
export const getScheduleSearchLibrary = (): ScheduleSearchLibrary => {
  library ??= new ScheduleSearchLibrary(createMMKV({id: 'mpeiapp-schedule-search'}));
  return library;
};

export const useScheduleSearchLibrary = () => {
  const store = getScheduleSearchLibrary();
  return {store, ...useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)};
};
