import type {LoadingProgressSnapshot} from './LoadingProgressService';

/** Keeps the loading copy useful before an asynchronous stage publishes progress. */
export const getLoadingProgressLabel = (
  progress: LoadingProgressSnapshot,
  fallbackLabel?: string,
): string => progress.current?.label ?? fallbackLabel ?? 'Загрузка...';
