import {
  createVpnRequestId,
  getMoscowRequestDate,
  getVpnRequestDeviceId,
  getVpnRequestDeviceIdFromDetails,
} from '../src/Vpn/VpnRequestId';

describe('DragoNet request identity', () => {
  it('uses the Moscow calendar date at a UTC day boundary', () => {
    const instant = new Date('2026-09-11T22:30:00.000Z');
    expect(getMoscowRequestDate(instant)).toBe('12-09-2026');
    expect(createVpnRequestId(instant, 'android-35-Pixel_8')).toBe('DragoNet-12-09-2026-android-35-Pixel_8');
  });

  it('always creates a safe fallback device identity when no serial is available', () => {
    expect(getVpnRequestDeviceIdFromDetails({
      os: 'android',
      version: 35,
      constants: {Model: 'Pixel 8 Pro'},
    })).toBe('android-35-Pixel_8_Pro');
    expect(getVpnRequestDeviceIdFromDetails({
      os: 'android',
      version: 35,
      constants: {Serial: 'AB C-123'},
    })).toBe('serial-AB_C-123');

    const deviceId = getVpnRequestDeviceId();
    expect(deviceId).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(deviceId.length).toBeGreaterThan(0);
    expect(deviceId.length).toBeLessThanOrEqual(160);
  });
});
