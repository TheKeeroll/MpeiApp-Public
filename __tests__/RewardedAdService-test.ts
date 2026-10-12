const mockLoader = {loadAd: jest.fn(), cancelLoading: jest.fn(() => Promise.resolve())};
const mockCreateLoader = jest.fn(() => Promise.resolve(mockLoader));
jest.mock('yandex-mobile-ads', () => ({RewardedAdLoader: {create: () => mockCreateLoader()}}));
import {RewardedAdService} from '../src/Ads/RewardedAdService';

type FakeAd = {show: jest.Mock; onAdShown?: () => void; onRewarded?: () => void; onAdDismissed?: () => void; onAdFailedToShow?: () => void};
describe('rewarded ad ownership', () => {
  const request = {adUnitId: 'demo-rewarded-yandex'};
  let service: RewardedAdService;
  let ad: FakeAd;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new RewardedAdService();
    ad = {show: jest.fn(() => Promise.resolve())};
    mockLoader.loadAd.mockResolvedValue(ad);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('shares loading and uses a ready ad without another request', async () => {
    expect(await Promise.all([service.preload(request), service.preload(request)])).toEqual([true, true]);
    expect(mockCreateLoader).toHaveBeenCalledTimes(1);
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
    expect(await service.preload(request)).toBe(true);
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
  });
  it('only grants onRewarded once, blocks another show/preload, and never reloads on dismissal', async () => {
    const grant = jest.fn();
    await service.preload(request);
    expect(await service.show(grant)).toBe(true);
    expect(grant).not.toHaveBeenCalled();
    expect(await service.show(grant)).toBe(false);
    expect(await service.preload(request)).toBe(false);
    ad.onRewarded!();
    ad.onRewarded!();
    expect(grant).toHaveBeenCalledTimes(1);
    expect(service.state).toBe('REWARDED');
    ad.onAdDismissed!();
    ad.onRewarded!();
    expect(grant).toHaveBeenCalledTimes(1);
    expect(service.state).toBe('DISMISSED');
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
  });
  it('invalidates a pending load and ignores its late result after disabling ads', async () => {
    let resolve!: (value: FakeAd) => void;
    mockLoader.loadAd.mockImplementation(() => new Promise(done => {resolve = done;}));
    const pending = service.preload(request);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    service.reset();
    expect(mockLoader.cancelLoading).toHaveBeenCalledTimes(1);
    resolve(ad);
    expect(await pending).toBe(false);
    expect(service.state).toBe('IDLE');
    expect(await service.show(jest.fn())).toBe(false);
  });
  it('does not even issue a native request if disabled during loader initialization', async () => {
    let resolve!: (value: typeof mockLoader) => void;
    mockCreateLoader.mockImplementationOnce(() => new Promise(done => {resolve = done;}));
    const pending = service.preload(request);
    service.reset();
    resolve(mockLoader);
    expect(await pending).toBe(false);
    expect(mockLoader.loadAd).not.toHaveBeenCalled();
  });
  it('settles cancelled waiters and permits a new load even when the native load promise never settles', async () => {
    mockLoader.loadAd.mockImplementationOnce(() => new Promise(() => undefined));
    const pending = service.preload(request);
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    service.reset();
    expect(await pending).toBe(false);
    expect(await service.preload(request)).toBe(true);
    expect(mockCreateLoader).toHaveBeenCalledTimes(2);
    expect(service.state).toBe('LOADED');
  });
  it('settles show from native lifecycle events even if the iOS show promise never resolves', async () => {
    await service.preload(request);
    ad.show.mockImplementationOnce(() => new Promise(() => undefined));
    const pending = service.show(jest.fn());
    ad.onAdShown!();
    expect(await pending).toBe(true);
    ad.onAdDismissed!();
    expect(service.state).toBe('DISMISSED');
  });
  it('ignores late rewards after invalidation and waits for the current native ad to close', async () => {
    const grant = jest.fn();
    await service.preload(request);
    await service.show(grant);
    service.reset();
    ad.onRewarded!();
    expect(grant).not.toHaveBeenCalled();
    expect(await service.preload(request)).toBe(false);
    ad.onAdDismissed!();
    expect(service.state).toBe('IDLE');
    expect(await service.preload(request)).toBe(true);
  });
  it('does not reward a failed show or automatically retry a failed load', async () => {
    mockLoader.loadAd.mockRejectedValueOnce(new Error('no fill'));
    expect(await service.preload(request)).toBe(false);
    expect(service.state).toBe('FAILED');
    expect(mockLoader.loadAd).toHaveBeenCalledTimes(1);
    await service.preload(request);
    const grant = jest.fn();
    ad.show.mockRejectedValueOnce(new Error('show failed'));
    expect(await service.show(grant)).toBe(false);
    ad.onRewarded!();
    expect(grant).not.toHaveBeenCalled();
    expect(service.state).toBe('FAILED');
  });
  it('ignores callbacks from an old dismissed ad after a new ad is loaded', async () => {
    await service.preload(request);
    await service.show(jest.fn());
    ad.onAdDismissed!();
    const next = {show: jest.fn(() => Promise.resolve())};
    mockLoader.loadAd.mockResolvedValueOnce(next);
    await service.preload(request);
    ad.onAdFailedToShow!();
    ad.onRewarded!();
    expect(service.state).toBe('LOADED');
  });
});
