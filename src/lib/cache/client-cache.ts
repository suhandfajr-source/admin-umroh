/**
 * Lightweight Client-side In-Memory Cache (Stale-While-Revalidate pattern)
 * Accelerates navigation between modules by rendering cached data in 0ms,
 * while automatically revalidating in the background.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

// Default cache duration: 60 seconds (revalidates silently in background)
const DEFAULT_MAX_AGE_MS = 60 * 1000;

export async function fetchWithCache<T = any>(
  url: string,
  options?: {
    maxAgeMs?: number;
    forceRefresh?: boolean;
    init?: RequestInit;
    onBackgroundUpdate?: (freshData: T) => void;
  }
): Promise<T> {
  const maxAge = options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  const isServer = typeof window === 'undefined';

  if (!isServer && !options?.forceRefresh) {
    const cached = memoryCache.get(url);
    if (cached) {
      const isFresh = Date.now() - cached.timestamp < maxAge;
      
      // If cached data is available, return it immediately (0ms instant render)
      // and trigger background revalidation if expired
      if (!isFresh || options?.onBackgroundUpdate) {
        // Background revalidation
        fetch(url, options?.init)
          .then(async (res) => {
            if (res.ok) {
              const freshData = await res.json();
              memoryCache.set(url, { data: freshData, timestamp: Date.now() });
              if (options?.onBackgroundUpdate) {
                options.onBackgroundUpdate(freshData);
              }
            }
          })
          .catch((err) => {
            console.warn('[CACHE_REVALIDATE_FAIL]', url, err);
          });
      }

      return cached.data;
    }
  }

  // Network fetch if not in cache or forceRefresh
  const res = await fetch(url, options?.init);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(errText || `HTTP Error ${res.status}`);
  }

  const data: T = await res.json();
  if (!isServer) {
    memoryCache.set(url, { data, timestamp: Date.now() });
  }

  return data;
}

export function setCachedData<T = any>(url: string, data: T): void {
  if (typeof window !== 'undefined') {
    memoryCache.set(url, { data, timestamp: Date.now() });
  }
}

export function invalidateCache(urlOrPattern?: string | RegExp): void {
  if (typeof window === 'undefined') return;

  if (!urlOrPattern) {
    memoryCache.clear();
    return;
  }

  if (typeof urlOrPattern === 'string') {
    for (const key of memoryCache.keys()) {
      if (key.includes(urlOrPattern)) {
        memoryCache.delete(key);
      }
    }
  } else if (urlOrPattern instanceof RegExp) {
    for (const key of memoryCache.keys()) {
      if (urlOrPattern.test(key)) {
        memoryCache.delete(key);
      }
    }
  }
}
