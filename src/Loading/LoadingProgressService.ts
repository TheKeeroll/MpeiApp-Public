export type LoadingStageStatus = 'success' | 'failed';

export type LoadingProgressSnapshot = Readonly<{
  current?: Readonly<{label: string}>;
  previous?: Readonly<{label: string; status: LoadingStageStatus}>;
}>;

export type LoadingProgressSession = Readonly<{
  key: string;
  id: number;
}>;

export type LoadingProgressListener = (snapshot: LoadingProgressSnapshot) => void;

type InternalSession = {
  id: number;
  snapshot: LoadingProgressSnapshot;
};

const emptySnapshot = (): LoadingProgressSnapshot => ({});

const copySnapshot = (snapshot: LoadingProgressSnapshot): LoadingProgressSnapshot => ({
  current: snapshot.current ? {label: snapshot.current.label} : undefined,
  previous: snapshot.previous
    ? {label: snapshot.previous.label, status: snapshot.previous.status}
    : undefined,
});

const normalizeKey = (key: string): string => {
  const normalized = key.trim();
  if (!normalized) {
    throw new Error('Loading progress key must not be empty.');
  }
  return normalized;
};

const normalizeLabel = (label: string): string => {
  const normalized = label.trim();
  if (!normalized) {
    throw new Error('Loading progress label must not be empty.');
  }
  return normalized;
};

/**
 * A framework-independent progress store. A session token prevents a late
 * asynchronous task from replacing progress that belongs to a newer login,
 * map, or schedule-search attempt with the same key.
 */
export class LoadingProgressService {
  private nextSessionId = 1;
  private readonly sessions = new Map<string, InternalSession>();
  private readonly listeners = new Map<string, Set<LoadingProgressListener>>();

  public start(key: string, label: string): LoadingProgressSession {
    const normalizedKey = normalizeKey(key);
    const session: InternalSession = {
      id: this.nextSessionId++,
      snapshot: {current: {label: normalizeLabel(label)}},
    };
    this.sessions.set(normalizedKey, session);
    this.emit(normalizedKey, session.snapshot);

    return {key: normalizedKey, id: session.id};
  }

  public advance(
    session: LoadingProgressSession,
    nextLabel: string,
    completedStatus: LoadingStageStatus = 'success',
  ): boolean {
    const active = this.getActiveSession(session);
    if (!active) {
      return false;
    }

    active.snapshot = {
      current: {label: normalizeLabel(nextLabel)},
      previous: active.snapshot.current
        ? {label: active.snapshot.current.label, status: completedStatus}
        : active.snapshot.previous,
    };
    this.emit(session.key, active.snapshot);
    return true;
  }

  public complete(
    session: LoadingProgressSession,
    status: LoadingStageStatus = 'success',
  ): boolean {
    const active = this.getActiveSession(session);
    if (!active) {
      return false;
    }

    active.snapshot = active.snapshot.current
      ? {
        previous: {
          label: active.snapshot.current.label,
          status,
        },
      }
      : active.snapshot;
    this.emit(session.key, active.snapshot);
    return true;
  }

  public fail(session: LoadingProgressSession): boolean {
    return this.complete(session, 'failed');
  }

  public clear(session: LoadingProgressSession): boolean {
    const active = this.getActiveSession(session);
    if (!active) {
      return false;
    }

    this.sessions.delete(session.key);
    this.emit(session.key, emptySnapshot());
    return true;
  }

  public getSnapshot(key: string): LoadingProgressSnapshot {
    const active = this.sessions.get(normalizeKey(key));
    return copySnapshot(active?.snapshot ?? emptySnapshot());
  }

  public subscribe(key: string, listener: LoadingProgressListener): () => void {
    const normalizedKey = normalizeKey(key);
    const subscribers = this.listeners.get(normalizedKey) ?? new Set<LoadingProgressListener>();
    subscribers.add(listener);
    this.listeners.set(normalizedKey, subscribers);
    listener(this.getSnapshot(normalizedKey));

    return () => {
      const currentSubscribers = this.listeners.get(normalizedKey);
      if (!currentSubscribers) {
        return;
      }

      currentSubscribers.delete(listener);
      if (currentSubscribers.size === 0) {
        this.listeners.delete(normalizedKey);
      }
    };
  }

  private getActiveSession(session: LoadingProgressSession): InternalSession | undefined {
    const active = this.sessions.get(session.key);
    return active?.id === session.id ? active : undefined;
  }

  private emit(key: string, snapshot: LoadingProgressSnapshot) {
    const subscribers = this.listeners.get(key);
    if (!subscribers) {
      return;
    }

    const safeSnapshot = copySnapshot(snapshot);
    for (const listener of subscribers) {
      listener(safeSnapshot);
    }
  }
}

export const loadingProgressService = new LoadingProgressService();
