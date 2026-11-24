import prisma from '@/lib/prisma';
import { roundMoney, toNumber } from '@/lib/number';
import { getTodayRange, parseMyanmarDateBoundary } from '@/lib/utils';

export interface CashierPerformanceRow {
  userId: string;
  name: string;
  email: string;
  role: string;
  invoiceCount: number;
  netSales: number;
  avgBasketSize: number;
  totalDiscounts: number;
  priceOverrideCount: number;
  voidRefundCount: number;
  voidRefundAmount: number;
  closedShiftCount: number;
  netCashVariance: number;
}

export interface CashierPerformanceReport {
  startDate: string;
  endDate: string;
  totals: {
    totalInvoices: number;
    totalNetSales: number;
    totalDiscounts: number;
    totalOverrides: number;
    totalVoidRefunds: number;
    netCashVariance: number;
  };
  cashiers: CashierPerformanceRow[];
}

export async function generateCashierPerformanceReport(params: {
  startDate?: string | null;
  endDate?: string | null;
} = {}): Promise<CashierPerformanceReport> {
  const todayRange = getTodayRange();
  const defaultStart = new Date(todayRange.start.getTime() - 29 * 86400_000);
  const start =
    (params.startDate ? parseMyanmarDateBoundary(params.startDate, false) : null) ?? defaultStart;
  const end =
    (params.endDate ? parseMyanmarDateBoundary(params.endDate, true) : null) ?? todayRange.end;

  const [users, sales, adjustments, overrides, shifts] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    }),
    prisma.sale.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: {
        userId: true,
        status: true,
        totalAmount: true,
        discountAmount: true,
      },
    }),
    prisma.saleAdjustment.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: {
        amount: true,
        sale: { select: { userId: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        action: 'PRICE_OVERRIDE',
        createdAt: { gte: start, lte: end },
      },
      select: { userId: true },
    }),
    prisma.shift.findMany({
      where: {
        status: 'CLOSED',
        closedAt: { gte: start, lte: end },
      },
      select: { userId: true, variance: true },
    }),
  ]);

  const map = new Map<string, CashierPerformanceRow>();
  for (const u of users) {
    map.set(u.id, {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      invoiceCount: 0,
      netSales: 0,
      avgBasketSize: 0,
      totalDiscounts: 0,
      priceOverrideCount: 0,
      voidRefundCount: 0,
      voidRefundAmount: 0,
      closedShiftCount: 0,
      netCashVariance: 0,
    });
  }

  for (const s of sales) {
    const row = map.get(s.userId);
    if (!row) continue;
    if (s.status === 'COMPLETED' || s.status === 'PARTIALLY_REFUNDED') {
      row.invoiceCount += 1;
      row.netSales = roundMoney(row.netSales + toNumber(s.totalAmount));
      row.totalDiscounts = roundMoney(row.totalDiscounts + toNumber(s.discountAmount));
    }
  }

  for (const adj of adjustments) {
    const row = map.get(adj.sale.userId);
    if (!row) continue;
    row.voidRefundCount += 1;
    row.voidRefundAmount = roundMoney(row.voidRefundAmount + toNumber(adj.amount));
  }

  for (const ov of overrides) {
    const row = map.get(ov.userId);
    if (!row) continue;
    row.priceOverrideCount += 1;
  }

  for (const sh of shifts) {
    const row = map.get(sh.userId);
    if (!row) continue;
    row.closedShiftCount += 1;
    row.netCashVariance = roundMoney(row.netCashVariance + toNumber(sh.variance));
  }

  const cashiers = Array.from(map.values())
    .map((r) => ({
      ...r,
      avgBasketSize: r.invoiceCount > 0 ? Math.round(r.netSales / r.invoiceCount) : 0,
    }))
    .filter(
      (r) =>
        r.invoiceCount > 0 ||
        r.voidRefundCount > 0 ||
        r.priceOverrideCount > 0 ||
        r.closedShiftCount > 0
    )
    .sort((a, b) => b.netSales - a.netSales);

  const totals = {
    totalInvoices: cashiers.reduce((s, r) => s + r.invoiceCount, 0),
    totalNetSales: roundMoney(cashiers.reduce((s, r) => s + r.netSales, 0)),
    totalDiscounts: roundMoney(cashiers.reduce((s, r) => s + r.totalDiscounts, 0)),
    totalOverrides: cashiers.reduce((s, r) => s + r.priceOverrideCount, 0),
    totalVoidRefunds: cashiers.reduce((s, r) => s + r.voidRefundCount, 0),
    netCashVariance: roundMoney(cashiers.reduce((s, r) => s + r.netCashVariance, 0)),
  };

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    totals,
    cashiers,
  };
}
