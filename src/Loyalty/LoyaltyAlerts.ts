import {Alert} from 'react-native';

const tokenWord = (amount: number): string => {
  const lastTwoDigits = amount % 100;
  const lastDigit = amount % 10;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return 'токенов';
  }
  if (lastDigit === 1) {
    return 'токен';
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return 'токена';
  }
  return 'токенов';
};

export const showInsufficientTokensAlert = (
  subject: string,
  requiredTokens: number,
  prefix?: string,
): void => {
  Alert.alert(
    'Недостаточно токенов',
    `${prefix ? `${prefix} ` : ''}Для «${subject}» нужно ${requiredTokens} ${tokenWord(requiredTokens)}. Посмотрите рекламу в разделе «Лояльность», чтобы пополнить баланс.`,
  );
};
