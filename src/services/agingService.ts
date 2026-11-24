import prisma from '@/lib/prisma';
import { roundMoney, toNumber } from '@/lib/number';
import { getMyanmarDateParts } from '@/lib/utils';

export type AgingBucketKey = 'd0_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export interface AgingBuckets {
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  totalDue: number;
}

export interface AgingAccountRow extends AgingBuckets {
  id: string;
  name: string;
  phone: string | null;
  unpaidCount: number;
  oldestDate: string | null;
}

export interface AgingReport {
  generatedAt: string;
  receivablesSummary: AgingBuckets & { accountCount: number };
  payablesSummary: AgingBuckets & { accountCount: number };
  receivables: AgingAccountRow[];
  payables: AgingAccountRow[];
}

export function getAgingBucketKey(ageDays: number): AgingBucketKey {
  if (ageDays <= 30) return 'd0_30';
  if (ageDays <= 60) return 'd31_60';
  if (ageDays <= 90) return 'd61_90';
  return 'd90_plus';
}

export function calculateMyanmarAgeDays(docDate: Date, now: Date = new Date()): number {
  const docParts = getMyanmarDateParts(docDate);
  const nowParts = getMyanmarDateParts(now);
  // getMyanmarDateParts().month is already 0-indexed (0..11)
  const docUtc = Date.UTC(docParts.year, docParts.month, docParts.day);
  const nowUtc = Date.UTC(nowParts.year, nowParts.month, nowParts.day);
  return Math.max(0, Math.floor((nowUtc - docUtc) / 86_400_000));
}

function emptyBuckets(): AgingBuckets {
  return { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalDue: 0 };
}

function addToBuckets(target: AgingBuckets, bucket: AgingBucketKey, amount: number) {
  target[bucket] = roundMoney(target[bucket] + amount);
  target.totalDue = roundMoney(target.totalDue + amount);
}

/**
 * Allocates an account's current outstanding balance across its unpaid documents.
 * Because repayments settle oldest invoices first (FIFO), any remaining unpaid balance
 * belongs to the NEWEST invoices first (LIFO allocation of remaining balance).
 */
function buildAgingRow(
  account: { id: string; name: string; phone: string | null; creditBalance: unknown },
  docsDesc: Array<{ dueAmount: unknown; createdAt: Date }>,
  now: Date
): AgingAccountRow | null {
  const balance = roundMoney(Math.max(0, toNumber(account.creditBalance)));
  // Paid-off accounts (creditBalance === 0) must NEVER show overdue due to stale doc.dueAmount
  if (balance <= 0) return null;

  const row: AgingAccountRow = {
    id: account.id,
    name: account.name,
    phone: account.phone,
    unpaidCount: 0,
    oldestDate: null,
    ...emptyBuckets(),
  };

  let remaining = balance;
  let oldestAllocated: Date | null = null;

  for (const doc of docsDesc) {
    if (remaining <= 0) break;
    const docDue = roundMoney(toNumber(doc.dueAmount));
    if (docDue <= 0) continue;
    const alloc = roundMoney(Math.min(docDue, remaining));
    if (alloc > 0) {
      const age = calculateMyanmarAgeDays(doc.createdAt, now);
      addToBuckets(row, getAgingBucketKey(age), alloc);
      row.unpaidCount += 1;
      if (!oldestAllocated || doc.createdAt < oldestAllocated) {
        oldestAllocated = doc.createdAt;
      }
      remaining = roundMoney(remaining - alloc);
    }
  }

  // Any opening/unlinked balance with no matching document defaults to 0-30 days
  if (remaining > 0.009) {
    addToBuckets(row, 'd0_30', remaining);
  }

  row.oldestDate = oldestAllocated ? oldestAllocated.toISOString() : null;
  return row.totalDue > 0 ? row : null;
}

export async function generateArApAgingReport(now: Date = new Date()): Promise<AgingReport> {
  const [customers, suppliers] = await Promise.all([
    prisma.customer.findMany({
      where: { creditBalance: { gt: 0 } },
      select: {
        id: true,
        name: true,
        phone: true,
        creditBalance: true,
        sales: {
          where: {
            status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
            dueAmount: { gt: 0 },
          },
          select: { id: true, dueAmount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
    prisma.supplier.findMany({
      where: { creditBalance: { gt: 0 } },
      select: {
        id: true,
        name: true,
        phone: true,
        creditBalance: true,
        purchaseOrders: {
          where: {
            status: 'RECEIVED',
            dueAmount: { gt: 0 },
          },
          select: { id: true, dueAmount: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    }),
  ]);

  const receivablesSummary = { ...emptyBuckets(), accountCount: 0 };
  const receivables: AgingAccountRow[] = [];

  for (const cust of customers) {
    const row = buildAgingRow(cust, cust.sales, now);
    if (row) {
      receivables.push(row);
      receivablesSummary.accountCount += 1;
      receivablesSummary.d0_30 = roundMoney(receivablesSummary.d0_30 + row.d0_30);
      receivablesSummary.d31_60 = roundMoney(receivablesSummary.d31_60 + row.d31_60);
      receivablesSummary.d61_90 = roundMoney(receivablesSummary.d61_90 + row.d61_90);
      receivablesSummary.d90_plus = roundMoney(receivablesSummary.d90_plus + row.d90_plus);
      receivablesSummary.totalDue = roundMoney(receivablesSummary.totalDue + row.totalDue);
    }
  }

  const payablesSummary = { ...emptyBuckets(), accountCount: 0 };
  const payables: AgingAccountRow[] = [];

  for (const sup of suppliers) {
    const row = buildAgingRow(sup, sup.purchaseOrders, now);
    if (row) {
      payables.push(row);
      payablesSummary.accountCount += 1;
      payablesSummary.d0_30 = roundMoney(payablesSummary.d0_30 + row.d0_30);
      payablesSummary.d31_60 = roundMoney(payablesSummary.d31_60 + row.d31_60);
      payablesSummary.d61_90 = roundMoney(payablesSummary.d61_90 + row.d61_90);
      payablesSummary.d90_plus = roundMoney(payablesSummary.d90_plus + row.d90_plus);
      payablesSummary.totalDue = roundMoney(payablesSummary.totalDue + row.totalDue);
    }
  }

  receivables.sort((a, b) => b.totalDue - a.totalDue);
  payables.sort((a, b) => b.totalDue - a.totalDue);

  return {
    generatedAt: now.toISOString(),
    receivablesSummary,
    payablesSummary,
    receivables,
    payables,
  };
}
