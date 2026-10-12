import {createMMKV, type MMKV} from 'react-native-mmkv';
import {initialDragoNetPromoState, normalizeDragoNetPromoState, recordDragoNetPromoImpression, shouldShowDragoNetPromo, type DragoNetPromoState} from './DragoNetPromoPolicy';

export type DragoNetPromoOpportunity = {
  readonly selected: boolean;
  counted: boolean;
};

const STATE_KEY = 'cycle';

export class DragoNetPromoService {
  constructor(private readonly storage: Pick<MMKV, 'getString' | 'set'> = createMMKV({id: 'mpeiapp-dragonet-promo'})) {}

  getState(): DragoNetPromoState {
    const raw = this.storage.getString(STATE_KEY);
    let state = initialDragoNetPromoState();
    try { if (raw) state = normalizeDragoNetPromoState(JSON.parse(raw)); } catch { /* Reset malformed data. */ }
    if (raw !== JSON.stringify(state)) this.storage.set(STATE_KEY, JSON.stringify(state));
    return state;
  }

  createOpportunity(random = Math.random()): DragoNetPromoOpportunity {
    return {selected: shouldShowDragoNetPromo(this.getState(), random), counted: false};
  }

  recordImpression(opportunity: DragoNetPromoOpportunity): boolean {
    if (!opportunity.selected || opportunity.counted) return false;
    // MMKV reads/writes are synchronous: separate components cannot lose increments.
    this.storage.set(STATE_KEY, JSON.stringify(recordDragoNetPromoImpression(this.getState())));
    opportunity.counted = true;
    return true;
  }
}

// Separate from BARS account storage so the device-wide cycle survives logout.
export const dragoNetPromoService = new DragoNetPromoService();
