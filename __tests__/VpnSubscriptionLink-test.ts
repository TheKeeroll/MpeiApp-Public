import {extractVpnClientName} from '../src/Vpn/VpnSubscriptionLink';

const configuration = {
  origin: 'https://sub.dragonet.example',
  pathPrefix: '/subscription',
};

describe('DragoNet subscription link parser', () => {
  it('decodes a client name once while retaining supported symbols', () => {
    expect(extractVpnClientName(
      'https://sub.dragonet.example/subscription/student%5B42%5D%40mpei_user',
      configuration,
    )).toBe('student[42]@mpei_user');
  });

  it.each([
    'http://sub.dragonet.example/subscription/student',
    'https://elsewhere.example/subscription/student',
    'https://sub.dragonet.example/another/student',
    'https://sub.dragonet.example/subscription/',
    'https://sub.dragonet.example/subscription/%E0%A4%A',
    'not a URL',
  ])('rejects invalid URLs: %s', link => {
    expect(extractVpnClientName(link, configuration)).toBeUndefined();
  });

  it('rejects names with a path separator or control symbol', () => {
    expect(extractVpnClientName(
      'https://sub.dragonet.example/subscription/student%2Fother',
      configuration,
    )).toBeUndefined();
    expect(extractVpnClientName(
      'https://sub.dragonet.example/subscription/student%0Aother',
      configuration,
    )).toBeUndefined();
  });
});
