import {CommonActions, type NavigationAction} from '@react-navigation/native';

let requestCounter = 0;

export const navigateToDragoNet = (navigation: {dispatch: (action: NavigationAction) => void}): void => {
  navigation.dispatch(CommonActions.navigate('other', {
    screen: 'settingsMain',
    pop: true,
    params: {dragoNetScrollRequest: `${Date.now()}:${++requestCounter}`},
  }));
};

export const getDragoNetScrollRequest = (params: unknown): string | undefined => {
  const request = typeof params === 'object' && params !== null
    ? (params as {dragoNetScrollRequest?: unknown}).dragoNetScrollRequest : undefined;
  return typeof request === 'string' && request.length > 0 ? request : undefined;
};

export const getDragoNetScrollOffset = (viewportHeight: number, contentHeight: number, cardY: number, cardHeight: number): number | undefined => {
  if (![viewportHeight, contentHeight, cardY, cardHeight].every(Number.isFinite)
    || viewportHeight <= 0 || cardHeight <= 0 || cardY < 0 || contentHeight < cardY + cardHeight) return undefined;
  const target = cardHeight >= viewportHeight ? cardY : cardY - (viewportHeight - cardHeight) / 2;
  return Math.max(0, Math.min(target, Math.max(0, contentHeight - viewportHeight)));
};
