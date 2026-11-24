import prisma from '@/lib/prisma';
import { roundMoney, toNumber } from '@/lib/number';
import { getMyanmarDateParts, parseMyanmarDateBoundary, roundQuantity } from '@/lib/utils';

export interface InventoryValuationCategoryRow {
  categoryId: string;
  categoryName: string;
  categoryNameMm: string | null;
  productCount: number;
  totalUnits: number;
  costValue: number;
  retailValue: number;
}

export interface DeadStockRow {
  productId: string;
  name: string;
  nameMm: string | null;
  sku: string;
  unit: string;
  categoryName: string;
  stockQuantity: number;
  costPrice: number;
  sellingPrice: number;
  tiedUpCapital: number;
}

export interface ReorderSuggestionRow {
  productId: string;
  name: string;
  nameMm: string | null;
  sku: string;
  unit: string;
  categoryName: string;
  stockQuantity: number;
  lowStockThreshold: number;
  costPrice: number;
  soldInWindow: number;
  avgDailySales: number;
  daysOfStockLeft: number | null;
  suggestedQty: number;
  estimatedCost: number;
}

export interface InventoryAnalyticsReport {
  deadDays: number;
  velocityDays: number;
  leadDays: number;
  summary: {
    totalActiveProducts: number;
    totalCostValue: number;
    totalRetailValue: number;
    potentialGrossProfit: number;
    marginPercent: number;
    deadStockCount: number;
    deadStockValue: number;
    reorderCount: number;
    estimatedReorderBudget: number;
  };
  byCategory: InventoryValuationCategoryRow[];
  deadStock: DeadStockRow[];
  reorderSuggestions: ReorderSuggestionRow[];
}

function getMyanmarDaysAgoDate(daysAgo: number): Date {
  const { year, month, day } = getMyanmarDateParts();
  const base = new Date(Date.UTC(year, month - 1, day - daysAgo));
  const y = base.getUTCFullYear();
  const m = String(base.getUTCMonth() + 1).padStart(2, '0');
  const d = String(base.getUTCDate()).padStart(2, '0');
  return parseMyanmarDateBoundary(`${y}-${m}-${d}`, false) ?? new Date(Date.now() - daysAgo * 86400_000);
}

export async function generateInventoryAnalytics(params: {
  deadDays?: number;
  velocityDays?: number;
  leadDays?: number;
} = {}): Promise<InventoryAnalyticsReport> {
  const deadDays = Math.min(365, Math.max(7, params.deadDays || 30));
  const velocityDays = Math.min(180, Math.max(7, params.velocityDays || 30));
  const leadDays = Math.min(90, Math.max(3, params.leadDays || 14));

  const deadStart = getMyanmarDaysAgoDate(deadDays);
  const velocityStart = getMyanmarDaysAgoDate(velocityDays);
  const earliestStart = deadStart < velocityStart ? deadStart : velocityStart;

  const [products, recentSaleItems] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: { select: { id: true, name: true, nameMm: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.saleItem.findMany({
      where: {
        sale: {
          status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
          createdAt: { gte: earliestStart },
        },
      },
      select: {
        productId: true,
        quantity: true,
        refundedQuantity: true,
        unitFactor: true,
        sale: { select: { createdAt: true } },
      },
    }),
  ]);

  const soldInDeadWindow = new Map<string, number>();
  const soldInVelocityWindow = new Map<string, number>();

  for (const item of recentSaleItems) {
    const netUnits = Math.max(0, toNumber(item.quantity) - toNumber(item.refundedQuantity));
    const factor = toNumber(item.unitFactor ?? 1) || 1;
    const baseUnits = roundQuantity(netUnits * factor);
    if (baseUnits <= 0) continue;

    if (item.sale.createdAt >= deadStart) {
      soldInDeadWindow.set(
        item.productId,
        roundQuantity((soldInDeadWindow.get(item.productId) ?? 0) + baseUnits)
      );
    }
    if (item.sale.createdAt >= velocityStart) {
      soldInVelocityWindow.set(
        item.productId,
        roundQuantity((soldInVelocityWindow.get(item.productId) ?? 0) + baseUnits)
      );
    }
  }

  let totalCostValue = 0;
  let totalRetailValue = 0;
  const catMap = new Map<string, InventoryValuationCategoryRow>();
  const deadStock: DeadStockRow[] = [];
  const reorderSuggestions: ReorderSuggestionRow[] = [];

  for (const product of products) {
    const stock = roundQuantity(toNumber(product.stockQuantity));
    const threshold = roundQuantity(toNumber(product.lowStockThreshold));
    const cost = roundMoney(toNumber(product.costPrice));
    const retail = roundMoney(toNumber(product.sellingPrice));

    const prodCostVal = roundMoney(stock * cost);
    const prodRetailVal = roundMoney(stock * retail);
    totalCostValue = roundMoney(totalCostValue + prodCostVal);
    totalRetailValue = roundMoney(totalRetailValue + prodRetailVal);

    const existingCat = catMap.get(product.categoryId) ?? {
      categoryId: product.categoryId,
      categoryName: product.category.name,
      categoryNameMm: product.category.nameMm,
      productCount: 0,
      totalUnits: 0,
      costValue: 0,
      retailValue: 0,
    };
    existingCat.productCount += 1;
    existingCat.totalUnits = roundQuantity(existingCat.totalUnits + stock);
    existingCat.costValue = roundMoney(existingCat.costValue + prodCostVal);
    existingCat.retailValue = roundMoney(existingCat.retailValue + prodRetailVal);
    catMap.set(product.categoryId, existingCat);

    const deadSold = soldInDeadWindow.get(product.id) ?? 0;
    if (stock > 0 && deadSold <= 0) {
      deadStock.push({
        productId: product.id,
        name: product.name,
        nameMm: product.nameMm,
        sku: product.sku,
        unit: product.unit,
        categoryName: product.category.name,
        stockQuantity: stock,
        costPrice: cost,
        sellingPrice: retail,
        tiedUpCapital: prodCostVal,
      });
    }

    const velSold = soldInVelocityWindow.get(product.id) ?? 0;
    const avgDaily = velSold / velocityDays;
    const daysLeft = avgDaily > 0 ? Math.round((stock / avgDaily) * 10) / 10 : null;
    const needsReorder =
      stock <= threshold || (daysLeft !== null && daysLeft <= leadDays);

    if (needsReorder) {
      const targetStock = Math.max(threshold * 2, Math.ceil(avgDaily * leadDays * 1.5), 1);
      const suggestedQty = Math.max(1, Math.ceil(targetStock - stock));
      reorderSuggestions.push({
        productId: product.id,
        name: product.name,
        nameMm: product.nameMm,
        sku: product.sku,
        unit: product.unit,
        categoryName: product.category.name,
        stockQuantity: stock,
        lowStockThreshold: threshold,
        costPrice: cost,
        soldInWindow: velSold,
        avgDailySales: Math.round(avgDaily * 100) / 100,
        daysOfStockLeft: daysLeft,
        suggestedQty,
        estimatedCost: roundMoney(suggestedQty * cost),
      });
    }
  }

  deadStock.sort((a, b) => b.tiedUpCapital - a.tiedUpCapital);
  reorderSuggestions.sort((a, b) => {
    const aDays = a.daysOfStockLeft ?? 9999;
    const bDays = b.daysOfStockLeft ?? 9999;
    return aDays - bDays || a.stockQuantity - b.stockQuantity;
  });

  const potentialGrossProfit = roundMoney(totalRetailValue - totalCostValue);
  const marginPercent =
    totalRetailValue > 0
      ? Math.round((potentialGrossProfit / totalRetailValue) * 1000) / 10
      : 0;
  const deadStockValue = roundMoney(deadStock.reduce((s, r) => s + r.tiedUpCapital, 0));
  const estimatedReorderBudget = roundMoney(
    reorderSuggestions.reduce((s, r) => s + r.estimatedCost, 0)
  );

  return {
    deadDays,
    velocityDays,
    leadDays,
    summary: {
      totalActiveProducts: products.length,
      totalCostValue,
      totalRetailValue,
      potentialGrossProfit,
      marginPercent,
      deadStockCount: deadStock.length,
      deadStockValue,
      reorderCount: reorderSuggestions.length,
      estimatedReorderBudget,
    },
    byCategory: Array.from(catMap.values()).sort((a, b) => b.costValue - a.costValue),
    deadStock,
    reorderSuggestions,
  };
}
