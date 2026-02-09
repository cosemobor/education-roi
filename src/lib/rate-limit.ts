interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limiters = new Map<string, Map<string, RateLimitEntry>>();

export function createRateLimiter(
  name: string,
  windowMs: number,
  maxRequests: number,
) {
  if (!limiters.has(name)) {
    limiters.set(name, new Map());
  }
  const store = limiters.get(name)!;

  // Periodic cleanup to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, windowMs);

  return function isRateLimited(key: string): boolean {
    const now = Date.now();
    const entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return false;
    }

    entry.count++;
    return entry.count > maxRequests;
  };
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}
