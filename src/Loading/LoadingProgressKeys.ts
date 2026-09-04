export const LOADING_PROGRESS_KEYS = {
  appInitialization: 'app-initialization',
  login: 'login',
  twoFactor: 'two-factor',
  authenticatedData: 'authenticated-data',
  map: 'map',
  scheduleSearch: 'schedule-search',
  qrScanner: 'qr-scanner',
} as const;

export type BARSDataSection =
  | 'marks'
  | 'schedule'
  | 'mail'
  | 'skippedClasses'
  | 'recordBook'
  | 'tasks'
  | 'reports'
  | 'stipends'
  | 'orders'
  | 'books'
  | 'questionnaires';

export const getBARSSectionProgressKey = (section: BARSDataSection): string => (
  `bars-section:${section}`
);
