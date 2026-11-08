import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, handleApiError } from '@/lib/apiAuth';
import { toNumber } from '@/lib/number';
import {
  getMyanmarDateKey,
  getMyanmarDateParts,
  getMyanmarHour,
  parseMyanmarDateBoundary,
} from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Default to current month in Myanmar timezone if no dates provided
    const nowParts = getMyanmarDateParts();
    const defaultStartStr = `${nowParts.year}-${String(nowParts.month + 1).padStart(2, '0')}-01`;
    const defaultEndStr = `${nowParts.year}-${String(nowParts.month + 1).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`;

    const start = parseMyanmarDateBoundary(startDate || defaultStartStr, false);
    if (!start) {
      return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
    }

    const end = parseMyanmarDateBoundary(endDate || defaultEndStr, true);
    if (!end) {
      return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 });
    }

    // Enforce max date range of 366 days
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < 0 || diffDays > 366) {
      return NextResponse.json(
        { error: 'Date range cannot exceed 366 days' },
        { status: 400 }
      );
    }

    const activeStatuses = ['COMPLETED', 'PARTIALLY_REFUNDED'];

    const salesInRange = await prisma.sale.count({
      where: {
        status: { in: activeStatuses },
        createdAt: { gte: start, lte: end },
      },
    });
    if (salesInRange > 10000) {
      return NextResponse.json({ error: 'Report is too large. Narrow the date range.' }, { status: 400 });
    }

    // Fetch completed/partially-refunded sales and expenses in range
    const [sales, expenses] = await Promise.all([
      prisma.sale.findMany({
        where: {
          status: { in: activeStatuses },
          createdAt: { gte: start, lte: end },
        },
        include: {
          items: {
            select: {
              quantity: true,
              refundedQuantity: true,
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
        take: 10000,
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

    // ── Summary Totals ───────────────────────────────────────
    const totalRevenue = sales.reduce((sum, s) => sum + toNumber(s.totalAmount), 0);
    const totalCost = sales.reduce(
      (sum, s) =>
        sum +
        s.items.reduce((itemSum, item) => {
          const netQty = Math.max(0, toNumber(item.quantity) - toNumber((item as { refundedQuantity?: unknown }).refundedQuantity));
          return itemSum + toNumber(item.costPrice) * netQty;
        }, 0),
      0
    );
    const totalProfit = totalRevenue - totalCost;
    const totalExpenses = expenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
    const netProfit = totalProfit - totalExpenses;
    const totalSalesCount = sales.length;
    const averageSaleValue =
      totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

    // ── Daily Sales (Myanmar Timezone) ───────────────────────
    const dailyMap = new Map<string, { revenue: number; count: number; profit: number; expenses: number; netProfit: number }>();

    for (const sale of sales) {
      const dateKey = getMyanmarDateKey(sale.createdAt);
      const existing = dailyMap.get(dateKey) || { revenue: 0, count: 0, profit: 0, expenses: 0, netProfit: 0 };
      const saleCost = sale.items.reduce((sum, item) => {
        const netQty = Math.max(0, toNumber(item.quantity) - toNumber((item as { refundedQuantity?: unknown }).refundedQuantity));
        return sum + toNumber(item.costPrice) * netQty;
      }, 0);
      const saleGrossProfit = toNumber(sale.totalAmount) - saleCost;
      existing.revenue += toNumber(sale.totalAmount);
      existing.count += 1;
      existing.profit += saleGrossProfit;
      existing.netProfit += saleGrossProfit;
      dailyMap.set(dateKey, existing);
    }

    for (const expense of expenses) {
      const dateKey = getMyanmarDateKey(expense.date);
      const existing = dailyMap.get(dateKey) || { revenue: 0, count: 0, profit: 0, expenses: 0, netProfit: 0 };
      const expAmt = toNumber(expense.amount);
      existing.expenses += expAmt;
      existing.netProfit -= expAmt;
      dailyMap.set(dateKey, existing);
    }

    // Fill in missing days in Myanmar timezone
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
      const data = dailyMap.get(dateKey) || { revenue: 0, count: 0, profit: 0, expenses: 0, netProfit: 0 };
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

    // ── Payment Method Breakdown ─────────────────────────────
    const paymentMap = new Map<string, { count: number; amount: number }>();
    for (const sale of sales) {
      const method = sale.paymentMethod;
      const existing = paymentMap.get(method) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += toNumber(sale.totalAmount);
      paymentMap.set(method, existing);
    }

    const paymentBreakdown = Array.from(paymentMap.entries()).map(
      ([method, data]) => ({
        method,
        count: data.count,
        amount: Math.round(data.amount),
      })
    );

    // ── Top 10 Products ──────────────────────────────────────
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
      for (const item of sale.items) {
        const netQty = Math.max(0, toNumber(item.quantity) - toNumber((item as { refundedQuantity?: unknown }).refundedQuantity));
        if (netQty <= 0) continue;
        const ratio = toNumber(item.quantity) > 0 ? netQty / toNumber(item.quantity) : 1;
        const existing = productMap.get(item.product.id) || {
          id: item.product.id,
          name: item.product.name,
          nameMm: item.product.nameMm,
          sku: item.product.sku,
          qtySold: 0,
          revenue: 0,
          cost: 0,
        };
        existing.qtySold = Math.round((existing.qtySold + netQty) * 1000) / 1000;
        existing.revenue += toNumber(item.total) * ratio;
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
        profitMargin:
          p.revenue > 0
            ? Math.round(((p.revenue - p.cost) / p.revenue) * 100)
            : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ── Category Breakdown ───────────────────────────────────
    const categoryMap = new Map<
      string,
      { name: string; nameMm: string | null; revenue: number; count: number }
    >();

    for (const sale of sales) {
      for (const item of sale.items) {
        const netQty = Math.max(0, toNumber(item.quantity) - toNumber((item as { refundedQuantity?: unknown }).refundedQuantity));
        if (netQty <= 0) continue;
        const ratio = toNumber(item.quantity) > 0 ? netQty / toNumber(item.quantity) : 1;
        const cat = item.product.category;
        const existing = categoryMap.get(cat.id) || {
          name: cat.name,
          nameMm: cat.nameMm,
          revenue: 0,
          count: 0,
        };
        existing.revenue += toNumber(item.total) * ratio;
        existing.count = Math.round((existing.count + netQty) * 1000) / 1000;
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

    // ── Hourly Distribution (Myanmar Timezone) ───────────────
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

    return NextResponse.json({
      summary: {
        totalRevenue: Math.round(totalRevenue),
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
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch report data');
  }
}
