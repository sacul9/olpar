import { prisma } from "./prisma";

const WINDOW_MS = 60_000; // 1 minute
const MAX_TOKENS = 120;   // 120 requests per minute per key

/**
 * Token bucket rate limiter using the database.
 * Returns true if the request is allowed, false if rate limited.
 */
export async function checkRateLimit(key: string): Promise<boolean> {
  const now = new Date();

  const record = await prisma.rateLimit.findUnique({ where: { key } });

  if (!record) {
    await prisma.rateLimit.create({
      data: { key, tokens: MAX_TOKENS - 1, lastRefill: now },
    });
    return true;
  }

  // Calculate tokens to add based on time elapsed
  const elapsed = now.getTime() - record.lastRefill.getTime();
  const refillRate = MAX_TOKENS / WINDOW_MS; // tokens per ms
  const newTokens = Math.min(
    MAX_TOKENS,
    record.tokens + Math.floor(elapsed * refillRate)
  );

  if (newTokens < 1) {
    return false; // Rate limited
  }

  await prisma.rateLimit.update({
    where: { key },
    data: { tokens: newTokens - 1, lastRefill: now },
  });

  return true;
}
