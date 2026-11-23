export const dynamic = 'force-dynamic';

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

  // --- Fetch today's active sales data (includes COMPLETED & PARTIALLY_REFUNDED) ---
  const todaySales = await prisma.sale.findMany({
    where: {
      ...saleScope,
      createdAt: { gte: todayStart, lte: todayEnd },
      status: { in: ACTIVE_SALE_STATUSES },
    },
    include: {
      customer: { select: { name: true } },
      items: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const todayRevenue = todaySales.reduce((sum, sale) => sum + toNumber(sale.totalAmount), 0);
  const totalSalesToday = todaySales.length;

  // --- Fetch total products count ---
  const totalProducts = await prisma.product.count({
    where: { isActive: true },
  });

  // Low stock: products where stockQuantity <= lowStockThreshold via SQL count
  const lowStockRows = await prisma.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS "count"
    FROM "Product"
    WHERE "isActive" = true AND "stockQuantity" <= "lowStockThreshold"
  `;
  const actualLowStockCount = lowStockRows[0]?.count ?? 0;

  // Low stock & Expiring within 30 days alert items for Dashboard widget
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const alertProductsRaw = await prisma.$queryRaw<
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
  `;

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
  const recentSalesRaw = todaySales.slice(0, 10);
  const recentSales = recentSalesRaw.map((sale) => ({
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerName: sale.customer?.name ?? null,
    itemCount: sale.items.length,
    totalAmount: toNumber(sale.totalAmount),
    paymentMethod: sale.paymentMethod,
    createdAt: sale.createdAt.toISOString(),
  }));

  // --- Top 5 selling products (last 30 days in Myanmar UTC+6:30, net of refunds, base-unit qty) ---
  const thirtyDaysAgo = getMyanmarDaysAgoStart(30);

  const topSaleItems = await prisma.saleItem.findMany({
    where: {
      sale: {
        ...saleScope,
        status: { in: ACTIVE_SALE_STATUSES },
        createdAt: { gte: thirtyDaysAgo },
      },
    },
    select: {
      productId: true,
      quantity: true,
      refundedQuantity: true,
      unitFactor: true,
      total: true,
      product: { select: { name: true } },
    },
  });

  const topProductAgg = new Map<
    string,
    { productId: string; productName: string; totalQuantity: number; totalRevenue: number }
  >();
  for (const item of topSaleItems) {
    const origQty = toNumber(item.quantity);
    const netQty = Math.max(0, origQty - toNumber(item.refundedQuantity));
    if (netQty <= 0) continue;
    const ratio = origQty > 0 ? netQty / origQty : 1;
    const baseUnits = roundQuantity(netQty * (toNumber(item.unitFactor) || 1));
    const netRevenue = toNumber(item.total) * ratio;

    const existing = topProductAgg.get(item.productId) ?? {
      productId: item.productId,
      productName: item.product?.name ?? 'Unknown Product',
      totalQuantity: 0,
      totalRevenue: 0,
    };
    existing.totalQuantity = roundQuantity(existing.totalQuantity + baseUnits);
    existing.totalRevenue += netRevenue;
    topProductAgg.set(item.productId, existing);
  }

  const topProducts = Array.from(topProductAgg.values())
    .map((tp) => ({
      ...tp,
      totalRevenue: Math.round(tp.totalRevenue),
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  // --- Sales chart data (last 7 days in Myanmar UTC+6:30) ---
  const dayLabels = getLastNDayLabels(7);
  const sevenDaysAgo = getMyanmarDaysAgoStart(6);

  const last7DaysSales = await prisma.sale.findMany({
    where: {
      ...saleScope,
      createdAt: { gte: sevenDaysAgo },
      status: { in: ACTIVE_SALE_STATUSES },
    },
    select: {
      totalAmount: true,
      createdAt: true,
    },
  });

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
