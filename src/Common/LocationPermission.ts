import {PermissionsAndroid, Platform} from 'react-native';
import Geolocation from 'react-native-geolocation-service';

/** Foreground permission only; Android's approximate location is sufficient. */
export const requestForegroundLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    return await Geolocation.requestAuthorization('whenInUse') === 'granted';
  }
  if (Platform.OS !== 'android') return false;
  const {ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION} = PermissionsAndroid.PERMISSIONS;
  const hasPermission = await PermissionsAndroid.check(ACCESS_COARSE_LOCATION)
    || await PermissionsAndroid.check(ACCESS_FINE_LOCATION);
  if (hasPermission) return true;
  // Android 12+ requires both in the same request to offer precise/approximate.
  const result = await PermissionsAndroid.requestMultiple([ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION]);
  return result[ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
    || result[ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
};
