import type {VpnEntitlementStatus} from './types';

export type DemoAccessUiState =
  | {kind: 'idle'}
  | {kind: 'requesting'}
  | {kind: 'ready'; demoSubURL: string; receivedAt: string}
  | {kind: 'cooldown' | 'service_error' | 'offline'};

export const getDemoFailureAlert = (kind: 'cooldown' | 'service_error' | 'offline'): Readonly<{title: string; message: string}> => {
  switch (kind) {
    case 'cooldown':
      return {
        title: 'Демо-доступ уже запрашивали',
        message: 'Для этого устройства или интернет-подключения уже выдавался демо-доступ. Во избежание злоупотреблений запросить его повторно можно лишь раз в две недели.',
      };
    case 'offline':
      return {
        title: 'Нет подключения к интернету',
        message: 'Не удалось подключиться к интернету. Проверьте подключение и попробуйте запросить демо-доступ снова.',
      };
    case 'service_error':
      return {
        title: 'Не удалось получить демо-доступ',
        message: 'Приносим извинения: сейчас сервис выдачи демо-доступа временно не работает. Мы восстановим его работу в ближайшее время. Пожалуйста, попробуйте снова позже.',
      };
  }
};

export type VpnSubscriptionUiState =
  | {kind: 'no-link'; entitlementStatus: 'NONE' | 'REVOKED'}
  | {kind: 'checking'; entitlementStatus: VpnEntitlementStatus}
  | {kind: 'active'; entitlementStatus: 'ACTIVE' | 'GRACE'}
  | {kind: 'inactive'; entitlementStatus: 'REVOKED'}
  | {kind: 'transient-error'; entitlementStatus: VpnEntitlementStatus}
  | {kind: 'offline'; entitlementStatus: VpnEntitlementStatus};
