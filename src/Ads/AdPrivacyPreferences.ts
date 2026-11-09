import BARSAPI from '../Common/Globals';
import {STORAGE_KEYS} from '../Common/Constants';

export const AD_PRIVACY_VERSION = 1;
export const PRIVACY_POLICY_URL = 'https://dragonservices.online/PrivacyPolicy.html?lang=ru';
export const TERMS_OF_USE_URL = 'https://dragonservices.online/TermsOfUse.html?lang=ru';

export type AdPrivacyPreferences = {
  version: typeof AD_PRIVACY_VERSION;
  adultConfirmed: boolean;
  personalizedAds: boolean;
  locationSharing: boolean;
};

export const DEFAULT_AD_PRIVACY: AdPrivacyPreferences = {
  version: AD_PRIVACY_VERSION,
  adultConfirmed: false,
  personalizedAds: false,
  locationSharing: false,
};

export const normalizeAdPrivacy = (preferences: AdPrivacyPreferences): AdPrivacyPreferences => {
  const personalizedAds = preferences.adultConfirmed && preferences.personalizedAds;
  return {
    version: AD_PRIVACY_VERSION,
    adultConfirmed: preferences.adultConfirmed,
    personalizedAds,
    locationSharing: personalizedAds && preferences.locationSharing,
  };
};

export const readAdPrivacy = (): AdPrivacyPreferences | undefined => {
  // Legacy GRANTED did not cover adulthood or a separate location choice.
  // Neither a legacy grant nor a legacy denial skips the new explanation.
  const raw = BARSAPI.mStorage.getString(STORAGE_KEYS.AD_PRIVACY_PREFERENCES);
  if (!raw) return undefined;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== AD_PRIVACY_VERSION
      || typeof value.adultConfirmed !== 'boolean'
      || typeof value.personalizedAds !== 'boolean'
      || typeof value.locationSharing !== 'boolean') return undefined;
    return normalizeAdPrivacy(value);
  } catch {
    return undefined;
  }
};

export const saveAdPrivacy = (preferences: AdPrivacyPreferences): AdPrivacyPreferences => {
  const normalized = normalizeAdPrivacy(preferences);
  BARSAPI.mStorage.set(STORAGE_KEYS.AD_PRIVACY_PREFERENCES, JSON.stringify(normalized));
  BARSAPI.mStorage.remove(STORAGE_KEYS.AD_USER_CONSENT);
  return normalized;
};
