/**
 * Versioned localStorage persistence. Each key owns one JSON document; writes
 * are debounced and batched. Bump a key's version and add a migration step in
 * `load` if its shape ever changes incompatibly.
 */

export const STORAGE_KEYS = {
  settings: 'bj.settings.v1',
  sessions: 'bj.sessions.v1',
  decisions: 'bj.decisions.v1',
  lifetime: 'bj.lifetime.v1',
} as const;

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

export function load<T>(key: StorageKey, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const pending = new Map<StorageKey, unknown>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  flushTimer = null;
  for (const [key, value] of pending) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota or privacy mode: training continues, history just won't survive.
    }
  }
  pending.clear();
}

export function save(key: StorageKey, value: unknown): void {
  pending.set(key, value);
  if (flushTimer === null) flushTimer = setTimeout(flush, 800);
}

/** Synchronous flush for page-unload moments. */
export function flushNow(): void {
  if (flushTimer !== null) clearTimeout(flushTimer);
  flush();
}

export function clearAll(): void {
  if (flushTimer !== null) clearTimeout(flushTimer);
  pending.clear();
  for (const key of Object.values(STORAGE_KEYS)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushNow);
}
