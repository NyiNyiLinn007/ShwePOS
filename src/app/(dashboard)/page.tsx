export const dynamic = 'force-dynamic';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import {
  getTodayRange,
  getLastNDayLabels,
  formatShortDate,
  getMyanmarDateParts,
  parseMyanmarDateBoundary,
  roundQuantity,
} from '@/lib/utils';
import { requirePageAuth } from '@/lib/pageAuth';
import DashboardClient from '@/components/dashboard/DashboardClient';
import { toNumber } from '@/lib/number';

const ACTIVE_SALE_STATUSES = ['COMPLETED', 'PARTIALLY_REFUNDED'];

function getMyanmarDaysAgoStart(daysAgo: number): Date {
  const { year, month, day } = getMyanmarDateParts();
  const target = new Date(Date.UTC(year, month, day - daysAgo));
  const key = `${target.getUTCFullYear()}-${String(target.getUTCMonth() + 1).padStart(2, '0')}-${String(target.getUTCDate()).padStart(2, '0')}`;
  return parseMyanmarDateBoundary(key, false) ?? new Date(Date.now() - daysAgo * 86400_000);
}

export default async function DashboardPage() {
  const session = await requirePageAuth();
  const isCashier = session.user.role === 'CASHIER';
  const saleScope = isCashier ? { userId: session.user.id } : {};
  const { start: todayStart, end: todayEnd } = getTodayRange();
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = getMyanmarDaysAgoStart(30);
  const sevenDaysAgo = getMyanmarDaysAgoStart(6);

  // Execute all 6 independent Dashboard DB queries in parallel (1 round-trip instead of 6)
  const [
    todaySales,
    totalProducts,
    lowStockRows,
    alertProductsRaw,
    topProductsRaw,
    last7DaysSales,
  ] = await Promise.all([
    prisma.sale.findMany({
      where: {
        ...saleScope,
        createdAt: { gte: todayStart, lte: todayEnd },
        status: { in: ACTIVE_SALE_STATUSES },
      },
      select: {
        id: true,
        invoiceNumber: true,
        totalAmount: true,
        paymentMethod: true,
        createdAt: true,
        customer: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.count({
      where: { isActive: true },
    }),
    prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS "count"
      FROM "Product"
      WHERE "isActive" = true AND "stockQuantity" <= "lowStockThreshold"
    `,
    prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        nameMm: string | null;
        sku: string;
        stockQuantity: number;
        lowStockThreshold: number;
        unit: string;
        expiryDate: Date | null;
        batchNumber: string | null;
      }>
    >`
      SELECT "id", "name", "nameMm", "sku",
             "stockQuantity"::float8 AS "stockQuantity",
             "lowStockThreshold"::float8 AS "lowStockThreshold",
             "unit", "expiryDate", "batchNumber"
      FROM "Product"
      WHERE "isActive" = true
        AND ("stockQuantity" <= "lowStockThreshold" OR ("expiryDate" IS NOT NULL AND "expiryDate" <= ${thirtyDaysFromNow}))
      ORDER BY "stockQuantity" ASC, "expiryDate" ASC NULLS LAST
      LIMIT 8
    `,
    prisma.$queryRaw<
      Array<{
        productId: string;
        productName: string;
        totalQuantity: number;
        totalRevenue: number;
      }>
    >`
      SELECT si."productId",
             COALESCE(p."name", 'Unknown Product') AS "productName",
             ROUND(SUM(GREATEST(0, si."quantity" - si."refundedQuantity") * COALESCE(NULLIF(si."unitFactor", 0), 1))::numeric, 3)::float8 AS "totalQuantity",
             ROUND(SUM(
               CASE
                 WHEN si."quantity" > 0 THEN si."total" * (GREATEST(0, si."quantity" - si."refundedQuantity") / si."quantity")
                 ELSE 0
               END
             )::numeric, 0)::float8 AS "totalRevenue"
      FROM "SaleItem" si
      INNER JOIN "Sale" s ON s."id" = si."saleId"
      LEFT JOIN "Product" p ON p."id" = si."productId"
      WHERE s."status" IN ('COMPLETED', 'PARTIALLY_REFUNDED')
        AND s."createdAt" >= ${thirtyDaysAgo}
        AND GREATEST(0, si."quantity" - si."refundedQuantity") > 0
        ${isCashier ? Prisma.sql`AND s."userId" = ${session.user.id}` : Prisma.empty}
      GROUP BY si."productId", p."name"
      ORDER BY "totalRevenue" DESC
      LIMIT 5
    `,
    prisma.sale.findMany({
      where: {
        ...saleScope,
        createdAt: { gte: sevenDaysAgo },
        status: { in: ACTIVE_SALE_STATUSES },
      },
      select: {
        totalAmount: true,
        createdAt: true,
      },
    }),
  ]);

  const todayRevenue = todaySales.reduce((sum, sale) => sum + toNumber(sale.totalAmount), 0);
  const totalSalesToday = todaySales.length;
  const actualLowStockCount = lowStockRows[0]?.count ?? 0;

  const alertProducts = alertProductsRaw.map((p) => ({
    id: p.id,
    name: p.name,
    nameMm: p.nameMm,
    sku: p.sku,
    stockQuantity: Number(p.stockQuantity),
    lowStockThreshold: Number(p.lowStockThreshold),
    unit: p.unit,
    expiryDate: p.expiryDate ? p.expiryDate.toISOString() : null,
    batchNumber: p.batchNumber,
  }));

  // --- Recent 10 sales ---
  const recentSales = todaySales.slice(0, 10).map((sale) => ({
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerName: sale.customer?.name ?? null,
    itemCount: sale._count.items,
    totalAmount: toNumber(sale.totalAmount),
    paymentMethod: sale.paymentMethod,
    createdAt: sale.createdAt.toISOString(),
  }));

  const topProducts = topProductsRaw.map((tp) => ({
    productId: tp.productId,
    productName: tp.productName,
    totalQuantity: roundQuantity(Number(tp.totalQuantity) || 0),
    totalRevenue: Math.round(Number(tp.totalRevenue) || 0),
  }));

  // --- Sales chart data (last 7 days in Myanmar UTC+6:30) ---
  const dayLabels = getLastNDayLabels(7);

  // Group sales by date label
  const salesByDay = new Map<string, number>();
  dayLabels.forEach((label) => salesByDay.set(label, 0));

  last7DaysSales.forEach((sale) => {
    const label = formatShortDate(sale.createdAt);
    const current = salesByDay.get(label) ?? 0;
    salesByDay.set(label, current + toNumber(sale.totalAmount));
  });

  const salesChartData = dayLabels.map((label) => ({
    date: label,
    amount: Math.round(salesByDay.get(label) ?? 0),
  }));

  return (
    <DashboardClient
      role={session.user.role}
      todayRevenue={todayRevenue}
      totalSales={totalSalesToday}
      totalProducts={totalProducts}
      lowStockCount={actualLowStockCount}
      recentSales={recentSales}
      topProducts={topProducts}
      salesChartData={salesChartData}
      alertProducts={alertProducts}
    />
  );
}
