import prisma from '@/lib/prisma';
import { ApiError } from '@/lib/apiAuth';
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
  approvedVoidRefundCount: number;
  approvedVoidRefundAmount: number;
  closedShiftCount: number;
  netCashVariance: number;
  totalAbsCashVariance: number;
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
    totalAbsCashVariance: number;
  };
  cashiers: CashierPerformanceRow[];
}

export async function generateCashierPerformanceReport(params: {
  startDate?: string | null;
  endDate?: string | null;
} = {}): Promise<CashierPerformanceReport> {
  const todayRange = getTodayRange();
  const defaultStart = new Date(todayRange.start.getTime() - 29 * 86400_000);

  let start = defaultStart;
  if (params.startDate) {
    const parsedStart = parseMyanmarDateBoundary(params.startDate, false);
    if (!parsedStart) {
      throw new ApiError('Invalid startDate format (expected YYYY-MM-DD)', 400);
    }
    start = parsedStart;
  }

  let end = todayRange.end;
  if (params.endDate) {
    const parsedEnd = parseMyanmarDateBoundary(params.endDate, true);
    if (!parsedEnd) {
      throw new ApiError('Invalid endDate format (expected YYYY-MM-DD)', 400);
    }
    end = parsedEnd;
  }

  if (start > end) {
    throw new ApiError('startDate cannot be after endDate', 400);
  }

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
        approverUserId: true,
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
      approvedVoidRefundCount: 0,
      approvedVoidRefundAmount: 0,
      closedShiftCount: 0,
      netCashVariance: 0,
      totalAbsCashVariance: 0,
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
    const amt = toNumber(adj.amount);
    const cashierRow = map.get(adj.sale.userId);
    if (cashierRow) {
      cashierRow.voidRefundCount += 1;
      cashierRow.voidRefundAmount = roundMoney(cashierRow.voidRefundAmount + amt);
    }
    const approverRow = map.get(adj.approverUserId);
    if (approverRow) {
      approverRow.approvedVoidRefundCount += 1;
      approverRow.approvedVoidRefundAmount = roundMoney(
        approverRow.approvedVoidRefundAmount + amt
      );
    }
  }

  for (const ov of overrides) {
    const row = map.get(ov.userId);
    if (!row) continue;
    row.priceOverrideCount += 1;
  }

  for (const sh of shifts) {
    const row = map.get(sh.userId);
    if (!row) continue;
    const variance = toNumber(sh.variance);
    row.closedShiftCount += 1;
    row.netCashVariance = roundMoney(row.netCashVariance + variance);
    row.totalAbsCashVariance = roundMoney(row.totalAbsCashVariance + Math.abs(variance));
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
        r.approvedVoidRefundCount > 0 ||
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
    totalAbsCashVariance: roundMoney(
      cashiers.reduce((s, r) => s + r.totalAbsCashVariance, 0)
    ),
  };

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    totals,
    cashiers,
  };
}
