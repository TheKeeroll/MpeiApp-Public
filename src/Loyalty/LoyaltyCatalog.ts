import type {AppIconName, QRFrameName} from '../API/BARS';

export type LoyaltyItemId =
  | 'light-theme'
  | 'icon-dragons'
  | 'icon-simple'
  | 'icon-matterial'
  | 'icon-gold'
  | 'icon-crymat'
  | 'icon-crysign'
  | 'qr-frame-empty'
  | 'qr-frame-black'
  | 'qr-frame-green'
  | 'qr-frame-red'
  | 'ads-removal';

export type LoyaltyItemKind = 'theme' | 'icon' | 'qr-frame' | 'ads-removal';

export type LoyaltyCatalogItem = {
  id: LoyaltyItemId;
  kind: LoyaltyItemKind;
  price: number;
  title: string;
  iconName?: Exclude<AppIconName, 'cool'>;
  frameName?: Exclude<QRFrameName, 'qr-frame'>;
};

export const LOYALTY_CATALOG: readonly LoyaltyCatalogItem[] = [
  {id: 'light-theme', kind: 'theme', price: 35, title: 'Светлая тема'},
  {id: 'icon-dragons', kind: 'icon', price: 25, title: 'Иконка dragons', iconName: 'dragons'},
  {id: 'icon-simple', kind: 'icon', price: 50, title: 'Иконка simple', iconName: 'simple'},
  {id: 'icon-matterial', kind: 'icon', price: 75, title: 'Иконка matterial', iconName: 'matterial'},
  {id: 'icon-gold', kind: 'icon', price: 100, title: 'Иконка gold', iconName: 'gold'},
  {id: 'icon-crymat', kind: 'icon', price: 100, title: 'Иконка crymat', iconName: 'crymat'},
  {id: 'icon-crysign', kind: 'icon', price: 100, title: 'Иконка crysign', iconName: 'crysign'},
  {id: 'qr-frame-empty', kind: 'qr-frame', price: 25, title: 'QR без рамки', frameName: 'empty'},
  {id: 'qr-frame-black', kind: 'qr-frame', price: 50, title: 'Чёрная QR-рамка', frameName: 'qr-frame-black'},
  {id: 'qr-frame-green', kind: 'qr-frame', price: 50, title: 'Зелёная QR-рамка', frameName: 'qr-frame-green'},
  {id: 'qr-frame-red', kind: 'qr-frame', price: 50, title: 'Красная QR-рамка', frameName: 'qr-frame-red'},
  {id: 'ads-removal', kind: 'ads-removal', price: 450, title: 'Отключение рекламы навсегда'},
];

export const getLoyaltyCatalogItem = (itemId: LoyaltyItemId): LoyaltyCatalogItem => {
  const item = LOYALTY_CATALOG.find(candidate => candidate.id === itemId);
  if (!item) {
    throw new Error(`Unknown loyalty catalog item: ${itemId}`);
  }

  return item;
};

export const getIconLoyaltyCatalogItem = (
  iconName: Exclude<AppIconName, 'cool'>,
): LoyaltyCatalogItem => {
  const item = LOYALTY_CATALOG.find(candidate => candidate.iconName === iconName);
  if (!item) {
    throw new Error(`No loyalty catalog item for icon: ${iconName}`);
  }

  return item;
};

export const getQRFrameLoyaltyCatalogItem = (
  frameName: Exclude<QRFrameName, 'qr-frame'>,
): LoyaltyCatalogItem => {
  const item = LOYALTY_CATALOG.find(candidate => candidate.frameName === frameName);
  if (!item) {
    throw new Error(`No loyalty catalog item for QR frame: ${frameName}`);
  }

  return item;
};
