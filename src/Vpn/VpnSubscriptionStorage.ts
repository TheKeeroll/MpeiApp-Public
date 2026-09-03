import type {VpnVerificationState} from './types';

/**
 * Persistent storage deliberately has no demo URL field. MMKV integration is
 * deferred until the DragoNet service is connected in stage 5.
 */
export type VpnSubscriptionStorage = Readonly<{
  readVerificationState: () => VpnVerificationState;
  writeVerificationState: (state: VpnVerificationState) => void;
  clearVerificationState: () => void;
}>;
