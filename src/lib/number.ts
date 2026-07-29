/** Convert Prisma Decimal (or a numeric input) at a server/client boundary. */
export function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value && typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    const result = (value as { toNumber: () => number }).toNumber();
    return Number.isFinite(result) ? result : 0;
  }
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Recursively convert Prisma Decimal values before crossing a JSON boundary. */
export function serializePrismaData(value: unknown): any {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    return toNumber(value);
  }
  if (Array.isArray(value)) return value.map((item) => serializePrismaData(item));
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, serializePrismaData(item)])
    );
  }
  return value;
}
