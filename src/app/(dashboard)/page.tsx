import { prisma } from '@/lib/prisma';
import { getTodayRange, getLastNDayLabels, formatShortDate } from '@/lib/utils';
import DashboardClient from '@/components/dashboard/DashboardClient';

export default async function DashboardPage() {
  const { start: todayStart, end: todayEnd } = getTodayRange();

  // --- Fetch today's sales data ---
  const todaySales = await prisma.sale.findMany({
    where: {
      createdAt: { gte: todayStart, lte: todayEnd },
      status: 'COMPLETED',
    },
    include: {
      customer: { select: { name: true } },
      items: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const todayRevenue = todaySales.reduce((sum, sale) => sum + sale.totalAmount, 0);
  const totalSalesToday = todaySales.length;

  // --- Fetch total products count ---
  const totalProducts = await prisma.product.count({
    where: { isActive: true },
  });

  // Low stock: products where stockQuantity <= lowStockThreshold
  // Prisma doesn't support comparing two fields directly, so we filter in memory
  const lowStockProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { stockQuantity: true, lowStockThreshold: true },
  });
  const actualLowStockCount = lowStockProducts.filter(
    (p) => p.stockQuantity <= p.lowStockThreshold
  ).length;

  // --- Recent 10 sales ---
  const recentSalesRaw = todaySales.slice(0, 10);
  const recentSales = recentSalesRaw.map((sale) => ({
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerName: sale.customer?.name ?? null,
    itemCount: sale.items.length,
    totalAmount: sale.totalAmount,
    paymentMethod: sale.paymentMethod,
    createdAt: sale.createdAt.toISOString(),
  }));

  // --- Top 5 selling products (all time for meaningful data, scoped to last 30 days) ---
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0, 0, 0, 0);

  const topProductsRaw = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: {
        status: 'COMPLETED',
        createdAt: { gte: thirtyDaysAgo },
      },
    },
    _sum: {
      quantity: true,
      total: true,
    },
    orderBy: {
      _sum: { total: 'desc' },
    },
    take: 5,
  });

  // Fetch product names for the top products
  const topProductIds = topProductsRaw.map((tp) => tp.productId);
  const productNames = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, name: true },
  });
  const productNameMap = new Map(productNames.map((p) => [p.id, p.name]));

  const topProducts = topProductsRaw.map((tp) => ({
    productId: tp.productId,
    productName: productNameMap.get(tp.productId) ?? 'Unknown Product',
    totalQuantity: tp._sum.quantity ?? 0,
    totalRevenue: tp._sum.total ?? 0,
  }));

  // --- Sales chart data (last 7 days) ---
  const dayLabels = getLastNDayLabels(7);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const last7DaysSales = await prisma.sale.findMany({
    where: {
      createdAt: { gte: sevenDaysAgo },
      status: 'COMPLETED',
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
    salesByDay.set(label, current + sale.totalAmount);
  });

  const salesChartData = dayLabels.map((label) => ({
    date: label,
    amount: Math.round(salesByDay.get(label) ?? 0),
  }));

  return (
    <DashboardClient
      todayRevenue={todayRevenue}
      totalSales={totalSalesToday}
      totalProducts={totalProducts}
      lowStockCount={actualLowStockCount}
      recentSales={recentSales}
      topProducts={topProducts}
      salesChartData={salesChartData}
    />
  );
}
