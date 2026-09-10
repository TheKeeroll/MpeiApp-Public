import BARSAPI from '../Common/Globals';
import {STORAGE_KEYS} from '../Common/Constants';
import {getDragoNetPublicConfiguration} from './DragoNetConfiguration';
import {createVpnRequestId} from './VpnRequestId';
import {createVpnSubscriptionStorage} from './VpnSubscriptionStorage';
import {VpnSubscriptionService} from './VpnSubscriptionService';
import {createVpnSubscriptionTransport} from './VpnSubscriptionTransport';

const configuration = getDragoNetPublicConfiguration();
const storage = createVpnSubscriptionStorage(BARSAPI.mStorage, {
  verificationState: STORAGE_KEYS.VPN_VERIFICATION_STATE,
  demoAccess: STORAGE_KEYS.VPN_DEMO_ACCESS,
});
const transport = createVpnSubscriptionTransport(configuration.proxy, {
  createRequestId: createVpnRequestId,
});

export const vpnSubscriptionService = new VpnSubscriptionService({
  transport,
  storage,
  subscriptionLinkConfiguration: configuration.subscriptionLink,
});

export const dragonetTelegramUrl = configuration.telegramUrl;

/** Registered before app initialization; BARS runs it after the core gate. */
BARSAPI.RegisterPostOnlineDataTask('vpn-subscription-revalidation', async isCurrent => {
  await vpnSubscriptionService.verify({shouldCommit: isCurrent, forceNew: true});
});
