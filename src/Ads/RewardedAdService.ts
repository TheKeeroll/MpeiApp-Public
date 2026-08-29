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
 * intentionally injected by the caller in stage 5 and runs only from onRewarded.
 */
export class RewardedAdService {
  private loader?: RewardedAdLoader;
  private loaderPromise?: Promise<RewardedAdLoader>;
  private loadingPromise?: Promise<boolean>;
  private loadedAd?: RewardedAd;
  private currentState: RewardedAdState = 'IDLE';
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
    if (this.loadedAd) {
      return true;
    }
    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.setState('LOADING');
    this.loadingPromise = this.load(adRequest);
    try {
      return await this.loadingPromise;
    } finally {
      this.loadingPromise = undefined;
    }
  }

  public async show(onRewarded: () => void): Promise<boolean> {
    const ad = this.loadedAd;
    if (!ad || this.currentState !== 'LOADED') {
      return false;
    }

    this.loadedAd = undefined;
    this.setState('SHOWING');
    let rewardGranted = false;

    ad.onRewarded = () => {
      if (rewardGranted) {
        return;
      }

      rewardGranted = true;
      this.setState('REWARDED');
      onRewarded();
    };
    ad.onAdDismissed = () => this.setState('DISMISSED');
    ad.onAdFailedToShow = error => {
      console.warn('Yandex rewarded ad failed to show', error);
      this.setState('FAILED');
    };

    try {
      await ad.show();
      return true;
    } catch (error) {
      console.warn('Yandex rewarded ad show request failed', error);
      this.setState('FAILED');
      return false;
    }
  }

  private async getLoader(): Promise<RewardedAdLoader> {
    if (this.loader) {
      return this.loader;
    }
    if (!this.loaderPromise) {
      this.loaderPromise = RewardedAdLoader.create();
    }

    try {
      this.loader = await this.loaderPromise;
      return this.loader;
    } finally {
      this.loaderPromise = undefined;
    }
  }

  private async load(adRequest: AdRequestParams): Promise<boolean> {
    try {
      const loader = await this.getLoader();
      this.loadedAd = await loader.loadAd(adRequest);
      this.setState('LOADED');
      return true;
    } catch (error) {
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
