import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, handleApiError } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Default to current month if no dates provided
    const now = new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);

    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    // Enforce max date range of 366 days
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays > 366) {
      return NextResponse.json(
        { error: 'Date range cannot exceed 366 days' },
        { status: 400 }
      );
    }

    // Fetch all completed sales in range with items and product data
    const sales = await prisma.sale.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end },
      },
      include: {
        items: {
          select: {
            quantity: true,
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
    });

    // ── Summary Totals ───────────────────────────────────────
    const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCost = sales.reduce(
      (sum, s) =>
        sum +
        s.items.reduce(
          (itemSum, item) => itemSum + item.costPrice * item.quantity,
          0
        ),
      0
    );
    const totalProfit = totalRevenue - totalCost;
    const totalSalesCount = sales.length;
    const averageSaleValue =
      totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;

    // ── Daily Sales ──────────────────────────────────────────
    const dailyMap = new Map<string, { revenue: number; count: number; profit: number }>();

    for (const sale of sales) {
      const dateKey = sale.createdAt.toISOString().split('T')[0];
      const existing = dailyMap.get(dateKey) || { revenue: 0, count: 0, profit: 0 };
      const saleCost = sale.items.reduce(
        (sum, item) => sum + item.costPrice * item.quantity,
        0
      );
      existing.revenue += sale.totalAmount;
      existing.count += 1;
      existing.profit += sale.totalAmount - saleCost;
      dailyMap.set(dateKey, existing);
    }

    // Fill in missing days
    const dailySales: Array<{
      date: string;
      revenue: number;
      count: number;
      profit: number;
    }> = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const dateKey = cursor.toISOString().split('T')[0];
      const data = dailyMap.get(dateKey) || { revenue: 0, count: 0, profit: 0 };
      dailySales.push({
        date: dateKey,
        revenue: Math.round(data.revenue),
        count: data.count,
        profit: Math.round(data.profit),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // ── Payment Method Breakdown ─────────────────────────────
    const paymentMap = new Map<string, { count: number; amount: number }>();
    for (const sale of sales) {
      const method = sale.paymentMethod;
      const existing = paymentMap.get(method) || { count: 0, amount: 0 };
      existing.count += 1;
      existing.amount += sale.totalAmount;
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
        const existing = productMap.get(item.product.id) || {
          id: item.product.id,
          name: item.product.name,
          nameMm: item.product.nameMm,
          sku: item.product.sku,
          qtySold: 0,
          revenue: 0,
          cost: 0,
        };
        existing.qtySold += item.quantity;
        existing.revenue += item.total;
        existing.cost += item.costPrice * item.quantity;
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
        const cat = item.product.category;
        const existing = categoryMap.get(cat.id) || {
          name: cat.name,
          nameMm: cat.nameMm,
          revenue: 0,
          count: 0,
        };
        existing.revenue += item.total;
        existing.count += item.quantity;
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

    // ── Hourly Distribution ──────────────────────────────────
    const hourlyMap = new Map<number, { count: number; revenue: number }>();
    for (let h = 0; h < 24; h++) {
      hourlyMap.set(h, { count: 0, revenue: 0 });
    }

    for (const sale of sales) {
      const hour = sale.createdAt.getHours();
      const existing = hourlyMap.get(hour)!;
      existing.count += 1;
      existing.revenue += sale.totalAmount;
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
