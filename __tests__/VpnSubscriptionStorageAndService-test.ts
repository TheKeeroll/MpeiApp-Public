import {
  createVpnSubscriptionStorage,
  VPN_DEMO_DURATION_MS,
  VPN_DEMO_MINIMUM_REMAINING_MS,
} from '../src/Vpn/VpnSubscriptionStorage';
import {VpnSubscriptionService} from '../src/Vpn/VpnSubscriptionService';
import type {VpnSubscriptionTransport} from '../src/Vpn/VpnSubscriptionTransport';
import NetInfo from '@react-native-community/netinfo';

const keys = {
  verificationState: 'verification',
  demoAccess: 'demo',
};

const createMemoryBackend = () => {
  const values = new Map<string, string>();
  return {
    values,
    backend: {
      getString: (key: string) => values.get(key),
      set: (key: string, value: string) => values.set(key, value),
      remove: (key: string) => values.delete(key),
    },
  };
};

describe('DragoNet demo persistence', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    [{reqStatus: 'failed', reason: 'demo_cooldown'}, 'cooldown'],
    [{reqStatus: 'failed', reason: 'service_error'}, 'service_error'],
    [{reqStatus: 'failed'}, 'service_error'],
  ] as const)('maps a proxy refusal without claiming a technical failure is abuse: %j', async (response, kind) => {
    const {backend, values} = createMemoryBackend();
    const service = new VpnSubscriptionService({
      transport: {isConfigured: true, verify: async () => ({reqStatus: 'failed'}), requestDemo: async () => response},
      storage: createVpnSubscriptionStorage(backend, keys),
      subscriptionLinkConfiguration: {origin: 'https://sub.dragonet.example', pathPrefix: '/subscription'},
      isNetworkAvailable: async () => true,
    });
    await expect(service.requestDemo()).resolves.toEqual({kind});
    expect(values.has(keys.demoAccess)).toBe(false);
  });

  it.each([[false, null], [true, false]])('checks NetInfo before sending demo and skips requests when connectivity is %j/%j', async (isConnected, isInternetReachable) => {
    jest.spyOn(NetInfo, 'fetch').mockResolvedValue({isConnected, isInternetReachable} as Awaited<ReturnType<typeof NetInfo.fetch>>);
    const requestDemo = jest.fn();
    const {backend} = createMemoryBackend();
    const service = new VpnSubscriptionService({
      transport: {isConfigured: true, verify: async () => ({reqStatus: 'failed'}), requestDemo},
      storage: createVpnSubscriptionStorage(backend, keys),
      subscriptionLinkConfiguration: {origin: 'https://sub.dragonet.example', pathPrefix: '/subscription'},
    });
    await expect(service.requestDemo()).resolves.toEqual({kind: 'offline'});
    expect(NetInfo.fetch).toHaveBeenCalled();
    expect(requestDemo).not.toHaveBeenCalled();
  });

  it.each([true, false])('distinguishes a transport failure from connectivity lost after preflight (still online: %j)', async stillOnline => {
    const network = jest.fn().mockResolvedValueOnce(true).mockResolvedValueOnce(stillOnline);
    const {backend} = createMemoryBackend();
    const service = new VpnSubscriptionService({
      transport: {isConfigured: true, verify: async () => ({reqStatus: 'failed'}), requestDemo: async () => {throw new Error('transport failed');}},
      storage: createVpnSubscriptionStorage(backend, keys),
      subscriptionLinkConfiguration: {origin: 'https://sub.dragonet.example', pathPrefix: '/subscription'},
      isNetworkAvailable: network,
    });
    await expect(service.requestDemo()).resolves.toEqual({kind: stillOnline ? 'service_error' : 'offline'});
  });

  it('attempts a demo when NetInfo cannot yet determine internet reachability', async () => {
    jest.spyOn(NetInfo, 'fetch').mockResolvedValue({isConnected: true, isInternetReachable: null} as Awaited<ReturnType<typeof NetInfo.fetch>>);
    const requestDemo = jest.fn(async () => ({reqStatus: 'failed' as const, reason: 'service_error' as const}));
    const {backend} = createMemoryBackend();
    const service = new VpnSubscriptionService({
      transport: {isConfigured: true, verify: async () => ({reqStatus: 'failed'}), requestDemo},
      storage: createVpnSubscriptionStorage(backend, keys),
      subscriptionLinkConfiguration: {origin: 'https://sub.dragonet.example', pathPrefix: '/subscription'},
    });
    await expect(service.requestDemo()).resolves.toEqual({kind: 'service_error'});
    expect(requestDemo).toHaveBeenCalledTimes(1);
  });
  it('restores the exact URL and issuance time until less than one hour remains', () => {
    const {backend, values} = createMemoryBackend();
    const receivedAt = new Date('2026-09-12T08:00:00.000Z');
    const storage = createVpnSubscriptionStorage(backend, keys, () => receivedAt);
    const access = {
      demoSubURL: 'https://sub.dragonet.example/demo/student',
      receivedAt: receivedAt.toISOString(),
    };

    storage.writeDemoAccess(access);
    expect(JSON.parse(values.get(keys.demoAccess) ?? '')).toEqual(access);
    expect(createVpnSubscriptionStorage(backend, keys, () => new Date('2026-09-13T08:00:00.000Z')).readDemoAccess()).toEqual(access);

    const almostExpired = new Date(receivedAt.getTime() + VPN_DEMO_DURATION_MS - VPN_DEMO_MINIMUM_REMAINING_MS + 1);
    expect(createVpnSubscriptionStorage(backend, keys, () => almostExpired).readDemoAccess()).toBeUndefined();
    expect(values.has(keys.demoAccess)).toBe(false);
  });

  it('does not save a demo URL after an unsuccessful response', async () => {
    const {backend, values} = createMemoryBackend();
    const storage = createVpnSubscriptionStorage(backend, keys, () => new Date('2026-09-12T10:00:00.000Z'));
    const transport: VpnSubscriptionTransport = {
      isConfigured: true,
      verify: async () => ({reqStatus: 'failed'}),
      requestDemo: async () => ({reqStatus: 'failed'}),
    };
    const service = new VpnSubscriptionService({
      transport,
      storage,
      subscriptionLinkConfiguration: {origin: 'https://sub.dragonet.example', pathPrefix: '/subscription'},
      isNetworkAvailable: async () => true,
    });

    await expect(service.requestDemo()).resolves.toEqual({kind: 'service_error'});
    expect(values.has(keys.demoAccess)).toBe(false);
  });

  it('uses one request for concurrent demo taps and stores no credentials or UUID field', async () => {
    const {backend, values} = createMemoryBackend();
    const storage = createVpnSubscriptionStorage(backend, keys, () => new Date('2026-09-12T10:00:00.000Z'));
    let resolveDemo: ((value: {reqStatus: 'success'; demoSubURL: string}) => void) | undefined;
    const requestDemo = jest.fn(() => new Promise<{reqStatus: 'success'; demoSubURL: string}>(resolve => {
      resolveDemo = resolve;
    }));
    const service = new VpnSubscriptionService({
      transport: {
        isConfigured: true,
        verify: async () => ({reqStatus: 'failed'}),
        requestDemo,
      },
      storage,
      subscriptionLinkConfiguration: {origin: 'https://sub.dragonet.example', pathPrefix: '/subscription'},
      now: () => new Date('2026-09-12T10:00:00.000Z'),
      isNetworkAvailable: async () => true,
    });

    const first = service.requestDemo();
    const second = service.requestDemo();
    await Promise.resolve();
    await Promise.resolve();
    expect(requestDemo).toHaveBeenCalledTimes(1);
    resolveDemo?.({reqStatus: 'success', demoSubURL: 'https://sub.dragonet.example/demo/student-token'});

    await expect(Promise.all([first, second])).resolves.toEqual([
      {
        kind: 'ready',
        access: {
          demoSubURL: 'https://sub.dragonet.example/demo/student-token',
          receivedAt: '2026-09-12T10:00:00.000Z',
        },
      },
      {
        kind: 'ready',
        access: {
          demoSubURL: 'https://sub.dragonet.example/demo/student-token',
          receivedAt: '2026-09-12T10:00:00.000Z',
        },
      },
    ]);
    expect(JSON.parse(values.get(keys.demoAccess) ?? '')).toEqual({
      demoSubURL: 'https://sub.dragonet.example/demo/student-token',
      receivedAt: '2026-09-12T10:00:00.000Z',
    });
  });
});
