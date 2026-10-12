import React from 'react';
import {View} from 'react-native';
import {useIsFocused} from '@react-navigation/native';
import {useLoyalty} from '../Loyalty/LoyaltyProvider';
import {isDragoNetPromoAllowed} from './DragoNetPromoPolicy';
import {dragoNetPromoService, type DragoNetPromoOpportunity} from './DragoNetPromoService';
import DragoNetPromoBanner from './DragoNetPromoBanner';

type Visit = {key: string; opportunity?: DragoNetPromoOpportunity};

// Owned by the screen, so a virtualized/remounted footer retains its decision and impression.
export const useDragoNetPromo = (key: string, eligible: boolean) => {
  const focused = useIsFocused();
  const {effectiveContentAccess, adsRemovalUnlocked} = useLoyalty();
  const allowed = isDragoNetPromoAllowed(effectiveContentAccess, adsRemovalUnlocked);
  const currentVisit = React.useRef<Visit | undefined>(undefined);
  const [visit, setVisit] = React.useState<Visit>();
  const viewportRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const refreshRef = React.useRef<() => void>(() => undefined);
  const refreshVisibility = React.useCallback(() => refreshRef.current(), []);
  React.useEffect(() => {
    if (!focused) {
      currentVisit.current = undefined;
      setVisit(undefined);
      return;
    }
    let next = currentVisit.current?.key === key ? currentVisit.current : {key};
    if (eligible && allowed && !next.opportunity) next = {...next, opportunity: dragoNetPromoService.createOpportunity()};
    currentVisit.current = next;
    setVisit(next);
  }, [focused, key, eligible, allowed]);
  const opportunity = focused && eligible && allowed && visit?.key === key ? visit.opportunity : undefined;
  return {
    viewportRef,
    refreshVisibility,
    banner: opportunity?.selected ? <DragoNetPromoBanner opportunity={opportunity} viewportRef={viewportRef} refreshRef={refreshRef}/> : null,
  };
};
