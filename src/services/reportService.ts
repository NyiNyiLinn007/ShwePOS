import prisma from '@/lib/prisma';
import { ApiError } from '@/lib/apiAuth';
import { toNumber } from '@/lib/number';
import {
  getMyanmarDateKey,
  getMyanmarDateParts,
  getMyanmarHour,
  parseMyanmarDateBoundary,
} from '@/lib/utils';

export async function generateSalesAndProfitReport(
  startDate?: string | null,
  endDate?: string | null
) {
  const nowParts = getMyanmarDateParts();
  const defaultStartStr = `${nowParts.year}-${String(nowParts.month + 1).padStart(2, '0')}-01`;
  const defaultEndStr = `${nowParts.year}-${String(nowParts.month + 1).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`;

  const start = parseMyanmarDateBoundary(startDate || defaultStartStr, false);
  if (!start) {
    throw new ApiError('Invalid startDate', 400);
  }

  const end = parseMyanmarDateBoundary(endDate || defaultEndStr, true);
  if (!end) {
    throw new ApiError('Invalid endDate', 400);
  }

  const diffMs = end.getTime() - start.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays < 0 || diffDays > 366) {
    throw new ApiError('Date range cannot exceed 366 days', 400);
  }

  const activeStatuses = ['COMPLETED', 'PARTIALLY_REFUNDED'];

  // Single parallel round-trip (take 10001 to enforce the 10,000-row cap without an extra COUNT query)
  const [sales, expenses] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: { in: activeStatuses },
        createdAt: { gte: start, lte: end },
      },
      include: {
        payments: {
          where: { type: 'CHECKOUT' },
          select: { method: true, amount: true },
        },
        adjustments: {
          select: { amount: true, paymentMethod: true },
        },
        items: {
          select: {
            quantity: true,
            refundedQuantity: true,
            unitFactor: true,
            unitPrice: true,
            total: true,
            costPrice: true,
            productId: true,
            product: {
              select: {
                id: true,
                name: true,
                nameMm: true,
                sku: true,
                categoryId: true,
                category: {
                  select: { id: true, name: true, nameMm: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 10001,
    }),
    prisma.expense.findMany({
      where: {
        date: { gte: start, lte: end },
      },
      select: {
        amount: true,
        date: true,
        category: true,
      },
    }),
  ]);

  if (sales.length > 10000) {
    throw new ApiError('Report is too large. Narrow the date range.', 400);
  }

  /** Compute net revenue excluding pro-rated sales tax so tax is never counted as Gross/Net Profit. */
  const getSaleNetExTax = (sale: (typeof sales)[number]): number => {
    const netTotal = toNumber(sale.totalAmount);
    const origTax = toNumber(sale.taxAmount);
    if (origTax <= 0 || netTotal <= 0) return netTotal;
    const origTotal = Math.max(
      netTotal,
      toNumber(sale.subtotal) - toNumber(sale.discountAmount) + origTax
    );
    const proRatedTax = origTotal > 0 ? (origTax * netTotal) / origTotal : origTax;
    return Math.max(0, netTotal - proRatedTax);
  };

  const totalRevenue = sales.reduce((sum, s) => sum + toNumber(s.totalAmount), 0);
  const totalRevenueExTax = sales.reduce((sum, s) => sum + getSaleNetExTax(s), 0);
  const totalTax = Math.max(0, totalRevenue - totalRevenueExTax);
  const totalCost = sales.reduce(
    (sum, s) =>
      sum +
      s.items.reduce((itemSum, item) => {
        const netQty = Math.max(
          0,
          toNumber(item.quantity) -
            toNumber((item as { refundedQuantity?: unknown }).refundedQuantity)
        );
        return itemSum + toNumber(item.costPrice) * netQty;
      }, 0),
    0
  );
  const totalProfit = totalRevenueExTax - totalCost;
  const totalExpenses = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
  const netProfit = totalProfit - totalExpenses;
  const totalSalesCount = sales.length;
  const averageSaleValue = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

  const dailyMap = new Map<
    string,
    { revenue: number; count: number; profit: number; expenses: number; netProfit: number }
  >();

  for (const sale of sales) {
    const dateKey = getMyanmarDateKey(sale.createdAt);
    const existing = dailyMap.get(dateKey) || {
      revenue: 0,
      count: 0,
      profit: 0,
      expenses: 0,
      netProfit: 0,
    };
    const saleCost = sale.items.reduce((sum, item) => {
      const netQty = Math.max(
        0,
        toNumber(item.quantity) -
          toNumber((item as { refundedQuantity?: unknown }).refundedQuantity)
      );
      return sum + toNumber(item.costPrice) * netQty;
    }, 0);
    const saleGrossProfit = getSaleNetExTax(sale) - saleCost;
    existing.revenue += toNumber(sale.totalAmount);
    existing.count += 1;
    existing.profit += saleGrossProfit;
    existing.netProfit += saleGrossProfit;
    dailyMap.set(dateKey, existing);
  }

  for (const expense of expenses) {
    const dateKey = getMyanmarDateKey(expense.date);
    const existing = dailyMap.get(dateKey) || {
      revenue: 0,
      count: 0,
      profit: 0,
      expenses: 0,
      netProfit: 0,
    };
    const expAmt = toNumber(expense.amount);
    existing.expenses += expAmt;
    existing.netProfit -= expAmt;
    dailyMap.set(dateKey, existing);
  }

  const dailySales: Array<{
    date: string;
    revenue: number;
    count: number;
    profit: number;
    expenses: number;
    netProfit: number;
  }> = [];
  const cursor = new Date(start.getTime() + 12 * 60 * 60 * 1000);
  const endCursor = new Date(end.getTime());
  while (cursor <= endCursor) {
    const dateKey = getMyanmarDateKey(cursor);
    const data = dailyMap.get(dateKey) || {
      revenue: 0,
      count: 0,
      profit: 0,
      expenses: 0,
      netProfit: 0,
    };
    dailySales.push({
      date: dateKey,
      revenue: Math.round(data.revenue),
      count: data.count,
      profit: Math.round(data.profit),
      expenses: Math.round(data.expenses),
      netProfit: Math.round(data.netProfit),
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Aggregate payment breakdown from actual SalePayment legs net of partial refund methods
  const paymentMap = new Map<string, { count: number; amount: number }>();
  for (const sale of sales) {
    if (sale.payments && sale.payments.length > 0) {
      const seenMethods = new Set<string>();
      for (const leg of sale.payments) {
        const existing = paymentMap.get(leg.method) || { count: 0, amount: 0 };
        if (!seenMethods.has(leg.method)) {
          existing.count += 1;
          seenMethods.add(leg.method);
        }
        existing.amount += toNumber(leg.amount);
        paymentMap.set(leg.method, existing);
      }
      for (const adj of sale.adjustments || []) {
        const adjAmt = toNumber(adj.amount);
        if (adjAmt <= 0) continue;
        const m = adj.paymentMethod || sale.paymentMethod;
        const existing = paymentMap.get(m);
        if (existing) {
          existing.amount = Math.max(0, existing.amount - adjAmt);
        }
      }
    } else {
      const method = sale.paymentMethod;
      const existing = paymentMap.get(method) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += toNumber(sale.totalAmount);
      paymentMap.set(method, existing);
    }
  }

  const paymentBreakdown = Array.from(paymentMap.entries())
    .map(([method, data]) => ({
      method,
      count: data.count,
      amount: Math.round(data.amount),
    }))
    .filter((row) => row.amount > 0 || row.count > 0);

  const productMap = new Map<
    string,
    {
      id: string;
      name: string;
      nameMm: string | null;
      sku: string;
      qtySold: number;
      revenue: number;
      cost: number;
    }
  >();

  for (const sale of sales) {
    const saleNetExTax = getSaleNetExTax(sale);
    const saleItemsNetTotal = sale.items.reduce((sum, item) => {
      const origQty = toNumber(item.quantity);
      const netQty = Math.max(
        0,
        origQty - toNumber((item as { refundedQuantity?: unknown }).refundedQuantity)
      );
      const ratio = origQty > 0 ? netQty / origQty : 0;
      return sum + toNumber(item.total) * ratio;
    }, 0);
    // Scale factor allocates cart/promotion/loyalty discounts proportionally across sold items
    const orderScale = saleItemsNetTotal > 0 ? saleNetExTax / saleItemsNetTotal : 1;

    for (const item of sale.items) {
      const origQty = toNumber(item.quantity);
      const netQty = Math.max(
        0,
        origQty - toNumber((item as { refundedQuantity?: unknown }).refundedQuantity)
      );
      if (netQty <= 0) continue;
      const ratio = origQty > 0 ? netQty / origQty : 1;
      const baseUnits = netQty * (toNumber(item.unitFactor) || 1);
      const allocatedRevenue = toNumber(item.total) * ratio * orderScale;
      const existing = productMap.get(item.product.id) || {
        id: item.product.id,
        name: item.product.name,
        nameMm: item.product.nameMm,
        sku: item.product.sku,
        qtySold: 0,
        revenue: 0,
        cost: 0,
      };
      existing.qtySold = Math.round((existing.qtySold + baseUnits) * 1000) / 1000;
      existing.revenue += allocatedRevenue;
      existing.cost += toNumber(item.costPrice) * netQty;
      productMap.set(item.product.id, existing);
    }
  }

  const topProducts = Array.from(productMap.values())
    .map((p) => ({
      ...p,
      profit: Math.round(p.revenue - p.cost),
      revenue: Math.round(p.revenue),
      cost: Math.round(p.cost),
      profitMargin: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const categoryMap = new Map<
    string,
    { name: string; nameMm: string | null; revenue: number; count: number }
  >();

  for (const sale of sales) {
    const saleNetExTax = getSaleNetExTax(sale);
    const saleItemsNetTotal = sale.items.reduce((sum, item) => {
      const origQty = toNumber(item.quantity);
      const netQty = Math.max(
        0,
        origQty - toNumber((item as { refundedQuantity?: unknown }).refundedQuantity)
      );
      const ratio = origQty > 0 ? netQty / origQty : 0;
      return sum + toNumber(item.total) * ratio;
    }, 0);
    const orderScale = saleItemsNetTotal > 0 ? saleNetExTax / saleItemsNetTotal : 1;

    for (const item of sale.items) {
      const origQty = toNumber(item.quantity);
      const netQty = Math.max(
        0,
        origQty - toNumber((item as { refundedQuantity?: unknown }).refundedQuantity)
      );
      if (netQty <= 0) continue;
      const ratio = origQty > 0 ? netQty / origQty : 1;
      const baseUnits = netQty * (toNumber(item.unitFactor) || 1);
      const cat = item.product.category;
      const existing = categoryMap.get(cat.id) || {
        name: cat.name,
        nameMm: cat.nameMm,
        revenue: 0,
        count: 0,
      };
      existing.revenue += toNumber(item.total) * ratio * orderScale;
      existing.count = Math.round((existing.count + baseUnits) * 1000) / 1000;
      categoryMap.set(cat.id, existing);
    }
  }

  const categoryBreakdown = Array.from(categoryMap.entries())
    .map(([id, data]) => ({
      id,
      name: data.name,
      nameMm: data.nameMm,
      revenue: Math.round(data.revenue),
      count: data.count,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const hourlyMap = new Map<number, { count: number; revenue: number }>();
  for (let h = 0; h < 24; h++) {
    hourlyMap.set(h, { count: 0, revenue: 0 });
  }

  for (const sale of sales) {
    const hour = getMyanmarHour(sale.createdAt);
    const existing = hourlyMap.get(hour)!;
    existing.count += 1;
    existing.revenue += toNumber(sale.totalAmount);
  }

  const hourlyDistribution = Array.from(hourlyMap.entries())
    .map(([hour, data]) => ({
      hour,
      label: `${hour.toString().padStart(2, '0')}:00`,
      count: data.count,
      revenue: Math.round(data.revenue),
    }))
    .sort((a, b) => a.hour - b.hour);

  return {
    summary: {
      totalRevenue: Math.round(totalRevenue),
      totalTax: Math.round(totalTax),
      totalProfit: Math.round(totalProfit),
      totalCost: Math.round(totalCost),
      totalExpenses: Math.round(totalExpenses),
      netProfit: Math.round(netProfit),
      totalSalesCount,
      averageSaleValue: Math.round(averageSaleValue),
    },
    dailySales,
    paymentBreakdown,
    topProducts,
    categoryBreakdown,
    hourlyDistribution,
    dateRange: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
  };
}
