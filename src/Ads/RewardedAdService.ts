import {RewardedAd, RewardedAdLoader, type AdRequestParams} from 'yandex-mobile-ads';

export type RewardedAdState =
  | 'IDLE'
  | 'LOADING'
  | 'LOADED'
  | 'SHOWING'
  | 'REWARDED'
  | 'DISMISSED'
  | 'FAILED';

type RewardedAdListener = (state: RewardedAdState) => void;

/**
 * Owns one loader and at most one preloaded rewarded ad. Token accounting is
 * injected by the caller and runs only once from the current onRewarded callback.
 */
export class RewardedAdService {
  private loader?: RewardedAdLoader;
  private loaderPromise?: Promise<RewardedAdLoader>;
  private loadingPromise?: Promise<boolean>;
  private cancelLoad?: () => void;
  private loadedAd?: RewardedAd;
  private currentState: RewardedAdState = 'IDLE';
  private generation = 0;
  private showing?: {generation: number; rewarded: boolean; finished: boolean};
  private listeners = new Set<RewardedAdListener>();

  public get state(): RewardedAdState {
    return this.currentState;
  }

  public subscribe(listener: RewardedAdListener): () => void {
    this.listeners.add(listener);
    listener(this.currentState);
    return () => this.listeners.delete(listener);
  }

  public async preload(adRequest: AdRequestParams): Promise<boolean> {
    if (this.showing) return false;
    if (this.loadedAd) {
      return true;
    }
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.setState('LOADING');
    const cancelled = new Promise<boolean>(resolve => { this.cancelLoad = () => resolve(false); });
    const loadingPromise = Promise.race([this.load(adRequest, this.generation), cancelled]);
    this.loadingPromise = loadingPromise;
    try {
      return await loadingPromise;
    } finally {
      if (this.loadingPromise === loadingPromise) {
        this.loadingPromise = undefined;
        this.cancelLoad = undefined;
      }
    }
  }

  /** Invalidates pending/ready ads without interfering with a native dismissal. */
  public reset(): void {
    this.generation++;
    this.loadedAd = undefined;
    if (this.loadingPromise) {
      // SDK 8.3 cancelLoading clears native load promises without settling them.
      // Settle our waiters and retire this loader so late native callbacks cannot
      // consume a subsequent request from the same loader's promise queue.
      this.cancelLoad?.();
      this.cancelLoad = undefined;
      this.loadingPromise = undefined;
      const loader = this.loader;
      this.loader = undefined;
      this.loaderPromise = undefined;
      if (loader) void loader.cancelLoading().catch(() => undefined);
    }
    if (!this.showing) this.setState('IDLE');
  }

  public async show(onRewarded: () => void): Promise<boolean> {
    const ad = this.loadedAd;
    if (!ad || this.currentState !== 'LOADED' || this.showing) {
      return false;
    }

    this.loadedAd = undefined;
    const showing = {generation: this.generation, rewarded: false, finished: false};
    this.showing = showing;
    this.setState('SHOWING');
    const isCurrent = () => this.showing === showing && !showing.finished && showing.generation === this.generation;
    const finish = (state: RewardedAdState) => {
      if (this.showing !== showing || showing.finished) return;
      showing.finished = true;
      this.showing = undefined;
      this.setState(showing.generation === this.generation ? state : 'IDLE');
    };

    ad.onRewarded = () => {
      if (!isCurrent() || showing.rewarded) {
        return;
      }

      showing.rewarded = true;
      this.setState('REWARDED');
      onRewarded();
    };
    // iOS 8.3 may emit lifecycle events without resolving showAd's native promise.
    return new Promise<boolean>(resolve => {
      ad.onAdShown = () => { if (isCurrent()) resolve(true); };
      ad.onAdDismissed = () => { finish('DISMISSED'); resolve(true); };
      ad.onAdFailedToShow = error => {
        if (isCurrent()) console.warn('Yandex rewarded ad failed to show', error);
        finish('FAILED');
        resolve(false);
      };
      try {
        void ad.show().then(() => resolve(true), error => {
          if (isCurrent()) console.warn('Yandex rewarded ad show request failed', error);
          finish('FAILED');
          resolve(false);
        });
      } catch (error) {
        console.warn('Yandex rewarded ad show request failed', error);
        finish('FAILED');
        resolve(false);
      }
    });
  }

  private async getLoader(): Promise<RewardedAdLoader> {
    if (this.loader) {
      return this.loader;
    }
    if (!this.loaderPromise) {
      this.loaderPromise = RewardedAdLoader.create();
    }

    const promise = this.loaderPromise;
    try {
      const loader = await promise;
      if (this.loaderPromise === promise) this.loader = loader;
      return loader;
    } finally {
      if (this.loaderPromise === promise) this.loaderPromise = undefined;
    }
  }

  private async load(adRequest: AdRequestParams, generation: number): Promise<boolean> {
    try {
      const loader = await this.getLoader();
      if (generation !== this.generation) return false;
      const ad = await loader.loadAd(adRequest);
      if (generation !== this.generation) return false;
      this.loadedAd = ad;
      this.setState('LOADED');
      return true;
    } catch (error) {
      if (generation !== this.generation) return false;
      console.warn('Yandex rewarded ad failed to load', error);
      this.setState('FAILED');
      return false;
    }
  }

  private setState(state: RewardedAdState): void {
    this.currentState = state;
    this.listeners.forEach(listener => listener(state));
  }
}

export const rewardedAdService = new RewardedAdService();
