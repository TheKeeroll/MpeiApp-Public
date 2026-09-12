import {
  buildVpnProxyEndpoint,
  createVpnSubscriptionTransport,
  isValidVpnProxyConfiguration,
} from '../src/Vpn/VpnSubscriptionTransport';

const configuration = {
  domain: 'proxy.dragonet.example',
  port: 8443,
  path: '/v1/subscription',
};

describe('DragoNet mobile transport', () => {
  it('accepts only a safe HTTPS domain, port, and path', () => {
    expect(isValidVpnProxyConfiguration(configuration)).toBe(true);
    expect(buildVpnProxyEndpoint(configuration)).toBe('https://proxy.dragonet.example:8443/v1/subscription');
    expect(isValidVpnProxyConfiguration({...configuration, domain: 'proxy.dragonet.example:443'})).toBe(false);
    expect(isValidVpnProxyConfiguration({...configuration, port: 0})).toBe(false);
    expect(isValidVpnProxyConfiguration({...configuration, path: '/v1//subscription'})).toBe(false);
  });

  it('sends the expected verify payload and maps a valid response', async () => {
    const fetchImplementation = jest.fn(async () => ({
      ok: true,
      json: async () => ({reqStatus: 'success', isClientFound: true, isClientActive: false}),
    })) as unknown as typeof fetch;
    const transport = createVpnSubscriptionTransport(configuration, {
      fetchImplementation,
      createRequestId: () => 'DragoNet-12-09-2026-device',
    });

    await expect(transport.verify('student_42')).resolves.toEqual({
      reqStatus: 'success',
      isClientFound: true,
      isClientActive: false,
    });
    expect(fetchImplementation).toHaveBeenCalledWith(
      'https://proxy.dragonet.example:8443/v1/subscription',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Mpei-App-Req-Id': 'DragoNet-12-09-2026-device',
        },
        body: JSON.stringify({purpose: 'verify', clientName: 'student_42'}),
      }),
    );
  });

  it('uses the demo payload and rejects malformed proxy answers', async () => {
    const fetchImplementation = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({reqStatus: 'success', demoSubURL: 'https://sub.dragonet.example/demo/student'}),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({reqStatus: 'success', demoSubURL: 'http://unsafe.example/demo'}),
      }) as unknown as typeof fetch;
    const transport = createVpnSubscriptionTransport(configuration, {
      fetchImplementation,
      createRequestId: () => 'request-id',
    });

    await expect(transport.requestDemo()).resolves.toEqual({
      reqStatus: 'success',
      demoSubURL: 'https://sub.dragonet.example/demo/student',
    });
    await expect(transport.requestDemo()).resolves.toEqual({reqStatus: 'failed'});
    expect(fetchImplementation).toHaveBeenNthCalledWith(
      1,
      expect.any(String),
      expect.objectContaining({body: JSON.stringify({purpose: 'demo'})}),
    );
  });

  it('does not issue requests when the public configuration is invalid', async () => {
    const fetchImplementation = jest.fn() as unknown as typeof fetch;
    const transport = createVpnSubscriptionTransport({...configuration, path: 'not-a-path'}, {fetchImplementation});

    expect(transport.isConfigured).toBe(false);
    await expect(transport.verify('student')).resolves.toEqual({reqStatus: 'failed'});
    await expect(transport.requestDemo()).resolves.toEqual({reqStatus: 'failed'});
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
