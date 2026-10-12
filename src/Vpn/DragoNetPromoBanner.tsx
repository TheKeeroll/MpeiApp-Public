import React from 'react';
import {AppState, Image, StyleSheet, Text, TouchableOpacity, View, type LayoutChangeEvent} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useTheme} from 'react-native-paper';
// @ts-expect-error
import * as MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {withOpacity, type CustomTheme} from '../Themes/Themes';
import {dragoNetPromoService, type DragoNetPromoOpportunity} from './DragoNetPromoService';
import {DragoNetPromoImpressionTracker, getVisibleAreaFraction, isDragoNetPromoRouteVisible, type WindowRect} from './DragoNetPromoVisibility';
import {navigateToDragoNet} from './DragoNetPromoNavigation';
import {DRAGONET_PROMO_ART, DragoNetSlogan, getDragoNetBannerArtFrame, PromoAppIconsMarquee} from './DragoNetPromoVisuals';

export type PromoViewport = {
  viewportRef: React.RefObject<React.ComponentRef<typeof View> | null>;
  refreshRef: React.RefObject<() => void>;
};

const DragoNetPromoBanner: React.FC<PromoViewport & {opportunity: DragoNetPromoOpportunity}> = ({opportunity, viewportRef, refreshRef}) => {
  const {colors} = useTheme<CustomTheme>();
  const navigation = useNavigation();
  const frameRef = React.useRef<React.ComponentRef<typeof View>>(null);
  const measurement = React.useRef(0);
  const [size, setSize] = React.useState({width: 0, height: 0});
  const canRecord = React.useCallback(() => (
    AppState.currentState === 'active' && navigation.isFocused() && isDragoNetPromoRouteVisible(navigation.getState?.())
  ), [navigation]);
  const tracker = React.useMemo(() => new DragoNetPromoImpressionTracker(
    dragoNetPromoService, opportunity, canRecord,
  ), [opportunity, canRecord]);
  const measure = React.useCallback(() => {
    const sequence = ++measurement.current;
    if (!frameRef.current || !viewportRef.current || !canRecord()) {
      tracker.updateVisibility(0);
      return;
    }
    tracker.beginMeasurement();
    let banner: WindowRect | undefined;
    let viewport: WindowRect | undefined;
    const update = () => {
      if (sequence === measurement.current && banner && viewport) tracker.updateVisibility(getVisibleAreaFraction(banner, viewport));
    };
    frameRef.current.measureInWindow((x, y, width, height) => { banner = {x, y, width, height}; update(); });
    viewportRef.current.measureInWindow((x, y, width, height) => { viewport = {x, y, width, height}; update(); });
  }, [canRecord, tracker, viewportRef]);
  React.useEffect(() => {
    refreshRef.current = measure;
    measure();
    const appSubscription = AppState.addEventListener('change', state => {
      if (state === 'active') measure();
      else { ++measurement.current; tracker.updateVisibility(0); }
    });
    const unsubscribeFocus = navigation.addListener('focus', measure);
    const unsubscribeBlur = navigation.addListener('blur', () => { ++measurement.current; tracker.updateVisibility(0); });
    const unsubscribeState = navigation.addListener('state', measure);
    return () => {
      ++measurement.current;
      tracker.dispose();
      appSubscription.remove();
      unsubscribeFocus();
      unsubscribeBlur();
      unsubscribeState();
      if (refreshRef.current === measure) refreshRef.current = () => undefined;
    };
  }, [measure, navigation, refreshRef, tracker]);
  const onLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setSize(previous => previous.width === width && previous.height === height ? previous : {width, height});
    measure();
  };
  const art = Image.resolveAssetSource(DRAGONET_PROMO_ART);
  const artFrame = getDragoNetBannerArtFrame(size.width, size.height, art?.width ?? 941, art?.height ?? 1430);
  return (
    <View ref={frameRef} collapsable={false} onLayout={onLayout} style={{width: '94%', maxWidth: 560, alignSelf: 'center', marginTop: 12, marginBottom: 8}}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={'DragoNet. Чтобы был не "Чебурнет" — подключайте DragoNet! Сервисы РФ доступны без отключения VPN. От 80 рублей в месяц.'}
        accessibilityHint="Открывает блок DragoNet в разделе «Прочее»"
        onPress={() => navigateToDragoNet(navigation)}
        style={{borderRadius: 10, overflow: 'hidden', backgroundColor: colors.primary}}
      >
        <View style={{width: '100%'}}>
          <Image source={DRAGONET_PROMO_ART} accessible={false} style={[StyleSheet.absoluteFill, {width: '100%', height: '100%', resizeMode: 'cover'}, artFrame]}/>
          <View style={{paddingHorizontal: 12, paddingVertical: 10, backgroundColor: withOpacity('#09070B', 78)}}>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 6}}>
              <Text style={{maxWidth: '100%', color: colors.accent, fontSize: 19, fontWeight: 'bold'}}>Drago{'\u200B'}Net</Text>
              <View style={{maxWidth: 190, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 5, backgroundColor: withOpacity('#120B24', 76)}}>
                <DragoNetSlogan/>
              </View>
            </View>
            <PromoAppIconsMarquee scale={0.56}/>
            <View style={{marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10}}>
              <Text style={{flexGrow: 1, flexBasis: 150, color: '#FFFFFF', fontSize: 12, lineHeight: 16}}>сервисы РФ доступны без отключения VPN</Text>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <Text style={{color: colors.accent, fontSize: 13, fontWeight: 'bold'}}>от 80 ₽/месяц</Text>
                <MaterialIcons.default name="chevron-right" size={20} color={colors.accent}/>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

export default DragoNetPromoBanner;
