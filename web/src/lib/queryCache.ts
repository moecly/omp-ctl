type Entry = { data: unknown; ts: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export function readCache<T>(key: string, ttl: number): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (Date.now() - e.ts > ttl) {
    store.delete(key);
    return undefined;
  }
  return e.data as T;
}

export function cachedInvoke<T>(key: string, fn: () => Promise<T>, ttl: number): Promise<T> {
  const hit = readCache<T>(key, ttl);
  if (hit !== undefined) {
    fn()
      .then((v) => store.set(key, { data: v, ts: Date.now() }))
      .catch(() => {});
    return Promise.resolve(hit);
  }
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const p = fn()
    .then((v) => {
      store.set(key, { data: v, ts: Date.now() });
      return v;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

export function prefetch(key: string, fn: () => Promise<unknown>, ttl: number) {
  if (readCache(key, ttl) !== undefined || inflight.has(key)) return;
  void cachedInvoke(key, fn, ttl).catch(() => {});
}

export function invalidate(prefix: string) {
  for (const k of [...store.keys()]) {
    if (k === prefix || k.startsWith(prefix)) store.delete(k);
  }
}
