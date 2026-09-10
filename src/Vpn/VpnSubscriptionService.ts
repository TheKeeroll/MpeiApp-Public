import NetInfo from '@react-native-community/netinfo';
import {DeviceEventEmitter} from 'react-native';
import {APP_EVENTS} from '../Common/AppEvents';
import {extractVpnClientName, type VpnSubscriptionLinkConfiguration} from './VpnSubscriptionLink';
import type {VpnSubscriptionStorage} from './VpnSubscriptionStorage';
import {applyVpnVerificationResult} from './VpnVerificationPolicy';
import type {
  VpnDemoAccess,
  VpnProxyDemoResponse,
  VpnProxyVerifyResponse,
  VpnVerificationResult,
  VpnVerificationState,
} from './types';
import type {VpnSubscriptionTransport} from './VpnSubscriptionTransport';

export type VpnVerificationRun = Readonly<{
  result: VpnVerificationResult;
  state: VpnVerificationState;
}>;

export type VpnVerificationOptions = Readonly<{
  /** Prevents a stale BARS background session from changing MMKV or access. */
  shouldCommit?: () => boolean;
  /** A new BARS session must not be joined to an older in-flight verification. */
  forceNew?: boolean;
}>;

export type VpnDemoRequestResult =
  | Readonly<{kind: 'ready'; access: VpnDemoAccess}>
  | Readonly<{kind: 'unavailable'}>;

export type VpnSubscriptionSnapshot = Readonly<{
  verificationState: VpnVerificationState;
  demoAccess: VpnDemoAccess | undefined;
  lastVerificationResult: VpnVerificationResult | undefined;
}>;

type VpnSubscriptionServiceOptions = Readonly<{
  transport: VpnSubscriptionTransport;
  storage: VpnSubscriptionStorage;
  subscriptionLinkConfiguration: VpnSubscriptionLinkConfiguration;
  now?: () => Date;
  isNetworkAvailable?: () => Promise<boolean>;
}>;

type SubscriptionListener = (snapshot: VpnSubscriptionSnapshot) => void;

const isNetworkAvailable = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected !== false && state.isInternetReachable !== false;
  } catch {
    // An inconclusive connectivity probe must not turn an available VPN into
    // an offline state; the real request will classify a failure as transient.
    return true;
  }
};

const mapVerifyResponse = (response: VpnProxyVerifyResponse): VpnVerificationResult => {
  if (response.reqStatus !== 'success') {
    return 'TRANSIENT_FAILURE';
  }
  return response.isClientFound && response.isClientActive
    ? 'ACTIVE'
    : 'INACTIVE_CONFIRMED';
};

const isSuccessfulDemoResponse = (
  response: VpnProxyDemoResponse,
): response is Extract<VpnProxyDemoResponse, {reqStatus: 'success'}> => response.reqStatus === 'success';

/**
 * Owns the one device-local DragoNet subscription state. It never logs a
 * client name or subscription URL, and all entitlement changes are published
 * to the existing ads and loyalty consumers.
 */
export class VpnSubscriptionService {
  private readonly listeners = new Set<SubscriptionListener>();
  private readonly now: () => Date;
  private readonly networkAvailable: () => Promise<boolean>;
  private verificationState: VpnVerificationState;
  private lastVerificationResult: VpnVerificationResult | undefined;
  private verificationPromise: Promise<VpnVerificationRun> | undefined;
  private demoRequestPromise: Promise<VpnDemoRequestResult> | undefined;

  public constructor(private readonly options: VpnSubscriptionServiceOptions) {
    this.now = options.now ?? (() => new Date());
    this.networkAvailable = options.isNetworkAvailable ?? isNetworkAvailable;
    this.verificationState = options.storage.readVerificationState();
  }

  public getSnapshot(): VpnSubscriptionSnapshot {
    return {
      verificationState: {...this.verificationState},
      demoAccess: this.options.storage.readDemoAccess(),
      lastVerificationResult: this.lastVerificationResult,
    };
  }

  public subscribe(listener: SubscriptionListener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  public setSubscriptionLink(link: string): boolean {
    const clientName = extractVpnClientName(link, this.options.subscriptionLinkConfiguration);
    if (!clientName) {
      return false;
    }

    this.verificationState = {
      clientName,
      technicalFailureStreak: 0,
      inactiveStreak: 0,
      lastEffectiveStatus: 'NONE',
    };
    this.lastVerificationResult = undefined;
    this.options.storage.writeVerificationState(this.verificationState);
    this.publish();
    return true;
  }

  public disconnect(): void {
    this.options.storage.clearVerificationState();
    this.verificationState = this.options.storage.readVerificationState();
    this.lastVerificationResult = undefined;
    this.publish();
  }

  public async verify(options: VpnVerificationOptions = {}): Promise<VpnVerificationRun> {
    if (!options.forceNew && this.verificationPromise) {
      return this.verificationPromise;
    }

    const verification = this.verifyInternal(options.shouldCommit ?? (() => true));
    this.verificationPromise = verification;
    try {
      return await verification;
    } finally {
      if (this.verificationPromise === verification) {
        this.verificationPromise = undefined;
      }
    }
  }

  private async verifyInternal(shouldCommit: () => boolean): Promise<VpnVerificationRun> {
    if (!shouldCommit()) {
      return {result: 'OFFLINE_SKIPPED', state: {...this.verificationState}};
    }
    const clientName = this.verificationState.clientName;
    if (!clientName || !this.options.transport.isConfigured) {
      return this.finishVerification('OFFLINE_SKIPPED', shouldCommit);
    }
    const shouldCommitCurrentClient = () => shouldCommit() && this.verificationState.clientName === clientName;

    if (!await this.networkAvailable()) {
      return this.finishVerification('OFFLINE_SKIPPED', shouldCommitCurrentClient);
    }

    let result: VpnVerificationResult;
    try {
      result = mapVerifyResponse(await this.options.transport.verify(clientName));
    } catch {
      result = 'TRANSIENT_FAILURE';
    }
    return this.finishVerification(result, shouldCommitCurrentClient);
  }

  public async requestDemo(): Promise<VpnDemoRequestResult> {
    if (this.demoRequestPromise) {
      return this.demoRequestPromise;
    }

    const request = this.requestDemoInternal();
    this.demoRequestPromise = request;
    try {
      return await request;
    } finally {
      if (this.demoRequestPromise === request) {
        this.demoRequestPromise = undefined;
      }
    }
  }

  private async requestDemoInternal(): Promise<VpnDemoRequestResult> {
    if (!this.options.transport.isConfigured || !await this.networkAvailable()) {
      return {kind: 'unavailable'};
    }

    try {
      const response = await this.options.transport.requestDemo();
      if (!isSuccessfulDemoResponse(response)) {
        return {kind: 'unavailable'};
      }

      const access: VpnDemoAccess = {
        demoSubURL: response.demoSubURL,
        receivedAt: this.now().toISOString(),
      };
      this.options.storage.writeDemoAccess(access);

      // Demo and a personal subscription are separate UI flows. Keep a paid
      // subscription's client name untouched when the user asks for a demo.
      this.notifyListeners();
      return {kind: 'ready', access};
    } catch {
      return {kind: 'unavailable'};
    }
  }

  private finishVerification(
    result: VpnVerificationResult,
    shouldCommit: () => boolean = () => true,
  ): VpnVerificationRun {
    if (!shouldCommit()) {
      return {result, state: {...this.verificationState}};
    }
    this.verificationState = applyVpnVerificationResult(this.verificationState, result, this.now());
    this.lastVerificationResult = result;
    this.options.storage.writeVerificationState(this.verificationState);
    this.publish();
    return {result, state: {...this.verificationState}};
  }

  private publish(): void {
    DeviceEventEmitter.emit(APP_EVENTS.VPN_ENTITLEMENT_CHANGED, {
      status: this.verificationState.lastEffectiveStatus,
    });
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}
