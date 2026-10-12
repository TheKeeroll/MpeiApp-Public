import React from 'react';
import {Animated, Easing, Image, Text, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import {withOpacity, type CustomTheme} from '../Themes/Themes';

export const DRAGONET_PROMO_ART = require('../../assets/images/DragoNet/DragoNet.webp');
export const DRAGONET_SLOGAN = 'Чтобы был не "Чебурнет" —\nподключайте DragoNet!';

// The individual sizes compensate for transparent margins in the source logos.
const PROMO_APP_ICONS = [
  {name: 'YouTube', source: require('../../assets/images/DragoNet/AppIconsForPromo/youtube.webp'), size: 66},
  {name: 'Instagram', source: require('../../assets/images/DragoNet/AppIconsForPromo/instagram.webp'), size: 66},
  {name: 'TikTok', source: require('../../assets/images/DragoNet/AppIconsForPromo/tiktok.webp'), size: 60},
  {name: 'Telegram', source: require('../../assets/images/DragoNet/AppIconsForPromo/telegram.webp'), size: 40},
  {name: 'Spotify', source: require('../../assets/images/DragoNet/AppIconsForPromo/spotify.webp'), size: 53},
  {name: 'Netflix', source: require('../../assets/images/DragoNet/AppIconsForPromo/netflix.webp'), size: 46},
  {name: 'Discord', source: require('../../assets/images/DragoNet/AppIconsForPromo/discord.webp'), size: 53},
  {name: 'Twitch', source: require('../../assets/images/DragoNet/AppIconsForPromo/twitch.webp'), size: 40},
  {name: 'Microsoft Copilot', source: require('../../assets/images/DragoNet/AppIconsForPromo/copilot.webp'), size: 42},
  {name: 'Google Gemini', source: require('../../assets/images/DragoNet/AppIconsForPromo/gemini.webp'), size: 40},
  {name: 'Xbox', source: require('../../assets/images/DragoNet/AppIconsForPromo/xbox.webp'), size: 40},
  {name: 'Nintendo', source: require('../../assets/images/DragoNet/AppIconsForPromo/nintendo.webp'), size: 46},
  {name: 'NTE', source: require('../../assets/images/DragoNet/AppIconsForPromo/nte.webp'), size: 66},
  {name: 'AniTokyoTV', source: require('../../assets/images/DragoNet/AppIconsForPromo/anitokyotv.webp'), size: 62},
] as const;

export const DragoNetSlogan: React.FC = () => {
  const {colors} = useTheme<CustomTheme>();
  return <Text style={{color: colors.accent, fontSize: 11, fontWeight: '600', lineHeight: 14, textAlign: 'right', textShadowColor: withOpacity('#000000', 72), textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2}}>{DRAGONET_SLOGAN}</Text>;
};

export const PromoAppIconsMarquee: React.FC<{scale?: number}> = ({scale = 1}) => {
  const translateX = React.useRef(new Animated.Value(0)).current;
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const cellWidth = 66 * scale;
  const rowHeight = 66 * scale;
  const loopWidth = PROMO_APP_ICONS.length * cellWidth;
  const copies = Math.max(3, Math.ceil(viewportWidth / loopWidth) + 1);
  const icons = Array.from({length: copies}, () => PROMO_APP_ICONS).flat();

  React.useEffect(() => {
    translateX.setValue(0);
    const animation = Animated.loop(Animated.timing(translateX, {
      toValue: -loopWidth,
      duration: 48000,
      easing: Easing.linear,
      useNativeDriver: true,
    }));
    animation.start();
    return () => animation.stop();
  }, [translateX, loopWidth]);

  return (
    <View accessible={false} onLayout={event => setViewportWidth(event.nativeEvent.layout.width)} style={{height: rowHeight, marginTop: 8, overflow: 'hidden'}}>
      <Animated.View style={{flexDirection: 'row', width: loopWidth * copies, transform: [{translateX}]}}>
        {icons.map((app, index) => (
          <View key={`${app.name}-${index}`} style={{width: cellWidth, height: rowHeight, alignItems: 'center', justifyContent: 'center'}}>
            <Image source={app.source} accessibilityLabel={app.name} style={{width: app.size * scale, height: app.size * scale, resizeMode: 'contain'}}/>
          </View>
        ))}
      </Animated.View>
    </View>
  );
};

export const getDragoNetBannerArtFrame = (width: number, height: number, artWidth: number, artHeight: number) => {
  if (width <= 0 || height <= 0 || artWidth <= 0 || artHeight <= 0) return undefined;
  const scale = Math.max(width / artWidth, height / artHeight);
  const imageWidth = artWidth * scale;
  const imageHeight = artHeight * scale;
  return {
    width: imageWidth,
    height: imageHeight,
    left: (width - imageWidth) / 2,
    // Same region as the supplied horizontal crop, using the original asset.
    top: Math.max(height - imageHeight, Math.min(0, height / 2 - imageHeight * 0.37)),
  };
};
