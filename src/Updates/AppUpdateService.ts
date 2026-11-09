import {APP_STORE_PAGES, CreateAppStoreHeaders, type BARSBrowserProfile} from '../Common/Constants';
import {parseAppStorePage, type AppStoreRelease, type AppStorePlatform} from '../API/Parsers/AppStoreParser';
import {compareAppVersions, normalizeAppVersion} from './AppVersion';

export const STORE_REQUEST_TIMEOUT_MS = 10000;
export const STORE_RETRY_DELAYS_MS = [1000, 3000] as const;
export type AppUpdate = AppStoreRelease & {storeName: string; storeUrl: string};

type CheckOptions = {
  platform: string;
  currentVersion: string;
  browserProfile: BARSBrowserProfile;
  signal?: AbortSignal;
  fetcher?: typeof fetch;
};

const pause = (duration: number, signal?: AbortSignal): Promise<boolean> => new Promise(resolve => {
  if (signal?.aborted) { resolve(false); return; }
  const finish = (continueChecking: boolean) => {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    resolve(continueChecking);
  };
  const cancel = () => finish(false);
  const timer = setTimeout(() => finish(true), duration);
  signal?.addEventListener('abort', cancel, {once: true});
});

const requestRelease = async (
  platform: AppStorePlatform,
  options: CheckOptions,
): Promise<AppStoreRelease> => {
  if (options.signal?.aborted) throw new Error('Update check cancelled');
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => undefined;
  // Race the whole operation, including response.text(): a stalled body must
  // settle even when a native fetch implementation ignores AbortSignal.
  const deadline = new Promise<never>((_, reject) => {
    cancel = () => { reject(new Error('Update check cancelled')); controller.abort(); };
    options.signal?.addEventListener('abort', cancel, {once: true});
    timer = setTimeout(() => {
      reject(new Error('Store request timed out'));
      controller.abort();
    }, STORE_REQUEST_TIMEOUT_MS);
  });
  try {
    return await Promise.race([
      (async () => {
        const response = await (options.fetcher ?? fetch)(APP_STORE_PAGES[platform].url, {
          method: 'GET', headers: CreateAppStoreHeaders(options.browserProfile),
          credentials: 'omit', signal: controller.signal,
        });
        if (!response.ok) throw new Error('Store returned an unsuccessful status');
        const html = await response.text();
        if (controller.signal.aborted) throw new Error('Store request expired');
        const parsed = parseAppStorePage(html, platform);
        if (!parsed) throw new Error('Store release could not be parsed');
        return parsed;
      })(),
      deadline,
    ]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
};

/** At most three bounded requests per opening. Failure is intentionally silent. */
export const checkForAppUpdate = async (options: CheckOptions): Promise<AppUpdate | undefined> => {
  if ((options.platform !== 'android' && options.platform !== 'ios')
    || !normalizeAppVersion(options.currentVersion)) return undefined;
  const platform = options.platform;
  for (let attempt = 0; attempt <= STORE_RETRY_DELAYS_MS.length; attempt++) {
    if (options.signal?.aborted) return undefined;
    if (attempt > 0 && !await pause(STORE_RETRY_DELAYS_MS[attempt - 1], options.signal)) return undefined;
    try {
      const latest = await requestRelease(platform, options);
      if (options.signal?.aborted || compareAppVersions(latest.version, options.currentVersion) !== 1) return undefined;
      const store = APP_STORE_PAGES[platform];
      return {...latest, storeName: store.name, storeUrl: store.url};
    } catch {
      if (options.signal?.aborted) return undefined;
    }
  }
  return undefined;
};
