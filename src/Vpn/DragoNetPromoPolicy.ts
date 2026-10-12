export type DragoNetPromoState = Readonly<{
  version: 1;
  phase: 'primary' | 'reduced';
  impressions: number;
}>;

export const initialDragoNetPromoState = (): DragoNetPromoState => ({version: 1, phase: 'primary', impressions: 0});

export const normalizeDragoNetPromoState = (value: unknown): DragoNetPromoState => {
  if (typeof value !== 'object' || value === null) return initialDragoNetPromoState();
  const state = value as Partial<DragoNetPromoState>;
  const limit = state.phase === 'primary' ? 10 : 25;
  if (state.version !== 1 || !['primary', 'reduced'].includes(state.phase ?? '')
    || !Number.isInteger(state.impressions) || state.impressions! < 0 || state.impressions! >= limit) {
    return initialDragoNetPromoState();
  }
  return {version: 1, phase: state.phase!, impressions: state.impressions!};
};

export const shouldShowDragoNetPromo = (state: DragoNetPromoState, random: number): boolean => (
  Number.isFinite(random) && random >= 0 && random < (state.phase === 'primary' ? 0.5 : 0.15)
);

export const recordDragoNetPromoImpression = (state: DragoNetPromoState): DragoNetPromoState => {
  const impressions = state.impressions + 1;
  if (impressions >= (state.phase === 'primary' ? 10 : 25)) {
    return {version: 1, phase: state.phase === 'primary' ? 'reduced' : 'primary', impressions: 0};
  }
  return {...state, impressions};
};

export const isDragoNetPromoAllowed = (effectiveContentAccess: boolean, adsRemovalUnlocked: boolean): boolean => (
  !effectiveContentAccess && !adsRemovalUnlocked
);
