import { prisma } from '@/lib/prisma';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export function normalizeRateLimitPart(value: unknown): string {
  const normalized = typeof value === 'string' ? value.toLowerCase().trim() : 'unknown';
  return normalized.slice(0, 256) || 'unknown';
}

/**
 * Use a database-backed atomic bucket so throttling is shared by all
 * serverless instances. The operation fails closed if the limiter database
 * operation fails instead of silently disabling abuse protection.
 */
export async function consumeRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const resetAt = new Date(Date.now() + windowMs);
  const rows = await prisma.$queryRaw<Array<{ count: number; resetAt: Date }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "createdAt", "updatedAt")
    VALUES (${key}, 1, ${resetAt}, NOW(), NOW())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN 1
        ELSE "RateLimitBucket"."count" + 1
      END,
      "resetAt" = CASE
        WHEN "RateLimitBucket"."resetAt" <= NOW() THEN ${resetAt}
        ELSE "RateLimitBucket"."resetAt"
      END,
      "updatedAt" = NOW()
    RETURNING "count", "resetAt"
  `;

  const bucket = rows[0];
  if (!bucket) {
    throw new Error('Rate-limit bucket was not returned');
  }

  const retryAfterSeconds = Math.max(0, Math.ceil((new Date(bucket.resetAt).getTime() - Date.now()) / 1000));
  return {
    allowed: bucket.count <= limit,
    retryAfterSeconds,
  };
}

export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimitBucket.deleteMany({ where: { key } });
}

export function getClientIp(headers: Headers): string {
  // Prefer platform-controlled headers. Do not use an arbitrary client header
  // as an identity boundary unless the deployment proxy overwrites it.
  const value =
    headers.get('x-vercel-forwarded-for') ??
    headers.get('x-real-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0];
  return normalizeRateLimitPart(value);
}
