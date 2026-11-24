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
  const docUtc = Date.UTC(docParts.year, docParts.month - 1, docParts.day);
  const nowUtc = Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day);
  return Math.max(0, Math.floor((nowUtc - docUtc) / 86_400_000));
}

function emptyBuckets(): AgingBuckets {
  return { d0_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0, totalDue: 0 };
}

function addToBuckets(target: AgingBuckets, bucket: AgingBucketKey, amount: number) {
  target[bucket] = roundMoney(target[bucket] + amount);
  target.totalDue = roundMoney(target.totalDue + amount);
}

export async function generateArApAgingReport(now: Date = new Date()): Promise<AgingReport> {
  const [customers, suppliers] = await Promise.all([
    prisma.customer.findMany({
      where: {
        OR: [
          { creditBalance: { gt: 0 } },
          {
            sales: {
              some: {
                status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
                dueAmount: { gt: 0 },
              },
            },
          },
        ],
      },
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
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
    prisma.supplier.findMany({
      where: {
        OR: [
          { creditBalance: { gt: 0 } },
          {
            purchaseOrders: {
              some: {
                status: 'RECEIVED',
                dueAmount: { gt: 0 },
              },
            },
          },
        ],
      },
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
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
  ]);

  const receivablesSummary = { ...emptyBuckets(), accountCount: 0 };
  const receivables: AgingAccountRow[] = [];

  for (const cust of customers) {
    const row: AgingAccountRow = {
      id: cust.id,
      name: cust.name,
      phone: cust.phone,
      unpaidCount: cust.sales.length,
      oldestDate: cust.sales[0]?.createdAt ? cust.sales[0].createdAt.toISOString() : null,
      ...emptyBuckets(),
    };

    const balanceCap = roundMoney(Math.max(0, toNumber(cust.creditBalance)));
    let remainingToBucket = balanceCap;

    // Distribute current creditBalance across unpaid invoices (newest-unpaid or FIFO oldest-unpaid)
    for (const sale of cust.sales) {
      if (remainingToBucket <= 0 && balanceCap > 0) break;
      const saleDue = roundMoney(toNumber(sale.dueAmount));
      const alloc = balanceCap > 0 ? roundMoney(Math.min(saleDue, remainingToBucket)) : saleDue;
      if (alloc > 0) {
        const age = calculateMyanmarAgeDays(sale.createdAt, now);
        addToBuckets(row, getAgingBucketKey(age), alloc);
        if (balanceCap > 0) remainingToBucket = roundMoney(remainingToBucket - alloc);
      }
    }

    if (remainingToBucket > 0.009) {
      addToBuckets(row, 'd0_30', remainingToBucket);
    }

    if (row.totalDue > 0) {
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
    const row: AgingAccountRow = {
      id: sup.id,
      name: sup.name,
      phone: sup.phone,
      unpaidCount: sup.purchaseOrders.length,
      oldestDate: sup.purchaseOrders[0]?.createdAt
        ? sup.purchaseOrders[0].createdAt.toISOString()
        : null,
      ...emptyBuckets(),
    };

    const balanceCap = roundMoney(Math.max(0, toNumber(sup.creditBalance)));
    let remainingToBucket = balanceCap;

    for (const po of sup.purchaseOrders) {
      if (remainingToBucket <= 0 && balanceCap > 0) break;
      const poDue = roundMoney(toNumber(po.dueAmount));
      const alloc = balanceCap > 0 ? roundMoney(Math.min(poDue, remainingToBucket)) : poDue;
      if (alloc > 0) {
        const age = calculateMyanmarAgeDays(po.createdAt, now);
        addToBuckets(row, getAgingBucketKey(age), alloc);
        if (balanceCap > 0) remainingToBucket = roundMoney(remainingToBucket - alloc);
      }
    }

    if (remainingToBucket > 0.009) {
      addToBuckets(row, 'd0_30', remainingToBucket);
    }

    if (row.totalDue > 0) {
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
