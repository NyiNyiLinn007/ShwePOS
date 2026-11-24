import prisma from '@/lib/prisma';
import { ApiError, type AuthUser } from '@/lib/apiAuth';
import { roundMoney, serializePrismaData, toNumber } from '@/lib/number';
import { getMyanmarDateCompact, isFractionalUnit, roundQuantity } from '@/lib/utils';
import type {
  CompleteStocktakeInput,
  CreateStocktakeInput,
  UpdateStocktakeItemsInput,
} from '@/lib/validations';
import type { StocktakeSessionDTO } from '@/types';
import { logAudit } from '@/services/auditService';

const sessionDetailInclude = {
  category: { select: { id: true, name: true, nameMm: true } },
  user: { select: { id: true, name: true } },
  completedBy: { select: { id: true, name: true } },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          nameMm: true,
          sku: true,
          barcode: true,
          unit: true,
          category: { select: { id: true, name: true, nameMm: true } },
          productUnits: {
            select: {
              id: true,
              unitName: true,
              conversionFactor: true,
              barcode: true,
            },
          },
        },
      },
    },
    orderBy: { product: { name: 'asc' as const } },
  },
};

export async function listStocktakeSessions(): Promise<StocktakeSessionDTO[]> {
  const sessions = await prisma.stocktakeSession.findMany({
    include: {
      category: { select: { id: true, name: true, nameMm: true } },
      user: { select: { id: true, name: true } },
      completedBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return serializePrismaData(sessions).map((s) => ({
    ...s,
    status: s.status as StocktakeSessionDTO['status'],
  }));
}

export async function getStocktakeSession(id: string) {
  const session = await prisma.stocktakeSession.findUnique({
    where: { id },
    include: sessionDetailInclude,
  });
  if (!session) {
    throw new ApiError('Stocktake session not found', 404);
  }
  return serializePrismaData(session);
}

export async function createStocktakeSession(input: CreateStocktakeInput, user: AuthUser) {
  const created = await prisma.$transaction(
    async (tx) => {
      const products = await tx.product.findMany({
        where: {
          isActive: true,
          ...(input.categoryId ? { categoryId: input.categoryId } : {}),
        },
        select: {
          id: true,
          stockQuantity: true,
          costPrice: true,
        },
        orderBy: { name: 'asc' },
      });

      if (products.length === 0) {
        throw new ApiError('No active products found for this stocktake scope', 400);
      }

      const dateStr = getMyanmarDateCompact();
      const counterKey = `ST-${dateStr}`;
      const counter = await tx.invoiceCounter.upsert({
        where: { date: counterKey },
        create: { date: counterKey, counter: 1 },
        update: { counter: { increment: 1 } },
      });
      const sessionNumber = `ST-${dateStr}-${counter.counter.toString().padStart(4, '0')}`;

      const session = await tx.stocktakeSession.create({
        data: {
          sessionNumber,
          status: 'IN_PROGRESS',
          categoryId: input.categoryId || null,
          userId: user.id,
          notes: input.notes?.trim() || null,
          totalItems: products.length,
          varianceItems: 0,
          totalVarianceValue: 0,
          items: {
            create: products.map((p) => ({
              productId: p.id,
              systemQty: roundQuantity(toNumber(p.stockQuantity)),
              countedQty: null,
              varianceQty: 0,
              unitCost: roundMoney(toNumber(p.costPrice)),
              varianceValue: 0,
            })),
          },
        },
        include: sessionDetailInclude,
      });

      return session;
    },
    { maxWait: 10_000, timeout: 20_000 }
  );

  return serializePrismaData(created);
}

export async function updateStocktakeItems(id: string, input: UpdateStocktakeItemsInput) {
  const updated = await prisma.$transaction(
    async (tx) => {
      const session = await tx.stocktakeSession.findUnique({
        where: { id },
        include: {
          items: {
            include: { product: { select: { unit: true, name: true } } },
          },
        },
      });
      if (!session) throw new ApiError('Stocktake session not found', 404);
      if (session.status !== 'IN_PROGRESS') {
        throw new ApiError('Only IN_PROGRESS stocktake sessions can be edited', 409);
      }

      const itemById = new Map(session.items.map((item) => [item.id, item]));
      for (const patch of input.items) {
        const existing = itemById.get(patch.itemId);
        if (!existing) {
          throw new ApiError(`Stocktake item not found: ${patch.itemId}`, 400);
        }
        const sysQty = roundQuantity(toNumber(existing.systemQty));
        const unitCost = roundMoney(toNumber(existing.unitCost));
        const counted = patch.countedQty === null ? null : roundQuantity(patch.countedQty);
        if (
          counted !== null &&
          !isFractionalUnit(existing.product.unit) &&
          !Number.isInteger(counted)
        ) {
          throw new ApiError(
            `Fractional count (${counted}) is not allowed for unit '${existing.product.unit}' on ${existing.product.name}`,
            400
          );
        }
        const varianceQty = counted === null ? 0 : roundQuantity(counted - sysQty);
        const varianceValue = counted === null ? 0 : roundMoney(varianceQty * unitCost);

        await tx.stocktakeItem.update({
          where: { id: existing.id },
          data: {
            countedQty: counted,
            varianceQty,
            varianceValue,
            ...(patch.notes !== undefined && { notes: patch.notes?.trim() || null }),
          },
        });
      }

      const refreshedItems = await tx.stocktakeItem.findMany({
        where: { sessionId: id },
        select: { countedQty: true, varianceQty: true, varianceValue: true },
      });

      let varianceItems = 0;
      let totalVarianceValue = 0;
      for (const item of refreshedItems) {
        if (item.countedQty !== null && Math.abs(toNumber(item.varianceQty)) > 0.0001) {
          varianceItems += 1;
          totalVarianceValue = roundMoney(totalVarianceValue + toNumber(item.varianceValue));
        }
      }

      const saved = await tx.stocktakeSession.update({
        where: { id },
        data: {
          varianceItems,
          totalVarianceValue,
          ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
        },
        include: sessionDetailInclude,
      });

      return saved;
    },
    { maxWait: 10_000, timeout: 20_000 }
  );

  return serializePrismaData(updated);
}

export async function completeStocktakeSession(
  id: string,
  input: CompleteStocktakeInput,
  user: AuthUser
) {
  const completed = await prisma.$transaction(
    async (tx) => {
      const session = await tx.stocktakeSession.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!session) throw new ApiError('Stocktake session not found', 404);
      if (session.status !== 'IN_PROGRESS') {
        throw new ApiError('Stocktake session is already finalized', 409);
      }

      // Atomically claim IN_PROGRESS -> COMPLETED FIRST to prevent double-completion / cancel races
      const claimed = await tx.stocktakeSession.updateMany({
        where: { id, status: 'IN_PROGRESS' },
        data: {
          status: 'COMPLETED',
          completedById: user.id,
          completedAt: new Date(),
        },
      });
      if (claimed.count === 0) {
        throw new ApiError('Stocktake session was already finalized or cancelled', 409);
      }

      const productIds = session.items.map((i) => i.productId);
      const liveProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, stockQuantity: true, costPrice: true, unit: true },
      });
      const liveMap = new Map(liveProducts.map((p) => [p.id, p]));

      let varianceItems = 0;
      let totalVarianceValue = 0;
      let adjustedCount = 0;

      for (const item of session.items) {
        const live = liveMap.get(item.productId);
        if (!live) continue;

        let effectiveCounted =
          item.countedQty !== null ? roundQuantity(toNumber(item.countedQty)) : null;

        if (effectiveCounted === null) {
          if (!input.applyUncountedAsZero) continue;
          effectiveCounted = 0;
        }

        const snapshotSystemQty = roundQuantity(toNumber(item.systemQty));
        const liveStock = roundQuantity(toNumber(live.stockQuantity));
        // Compute shrinkage/surplus delta relative to snapshot systemQty so interim POS sales / PO receipts
        // that occurred while counting are NEVER silently wiped out.
        const countDelta = roundQuantity(effectiveCounted - snapshotSystemQty);
        const targetLiveStock = roundQuantity(Math.max(0, liveStock + countDelta));
        const actualAdjustment = roundQuantity(targetLiveStock - liveStock);
        const unitCost = roundMoney(toNumber(item.unitCost) || toNumber(live.costPrice));
        const varianceValue = roundMoney(actualAdjustment * unitCost);

        await tx.stocktakeItem.update({
          where: { id: item.id },
          data: {
            countedQty: effectiveCounted,
            varianceQty: actualAdjustment,
            varianceValue,
          },
        });

        if (Math.abs(actualAdjustment) > 0.0001) {
          varianceItems += 1;
          totalVarianceValue = roundMoney(totalVarianceValue + varianceValue);
          adjustedCount += 1;

          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: targetLiveStock },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              userId: user.id,
              quantity: targetLiveStock,
              type: 'ADJUSTMENT',
              reason: `Stocktake ${session.sessionNumber}${item.notes ? `: ${item.notes}` : ''}`,
              previousStock: liveStock,
              newStock: targetLiveStock,
            },
          });
        }
      }

      const finalSession = await tx.stocktakeSession.update({
        where: { id },
        data: {
          varianceItems,
          totalVarianceValue,
          ...(input.notes !== undefined && { notes: input.notes?.trim() || session.notes }),
        },
        include: sessionDetailInclude,
      });

      await logAudit(
        {
          userId: user.id,
          action: 'STOCKTAKE_COMPLETED',
          entityType: 'STOCKTAKE',
          entityId: session.id,
          summary: `Completed stocktake ${session.sessionNumber}: ${adjustedCount} product(s) adjusted, net variance ${totalVarianceValue} K`,
          metadata: {
            sessionNumber: session.sessionNumber,
            totalItems: session.totalItems,
            varianceItems,
            adjustedCount,
            totalVarianceValue,
          },
        },
        tx
      );

      return finalSession;
    },
    { maxWait: 10_000, timeout: 30_000 }
  );

  return serializePrismaData(completed);
}

export async function cancelStocktakeSession(id: string) {
  const claimed = await prisma.stocktakeSession.updateMany({
    where: { id, status: 'IN_PROGRESS' },
    data: { status: 'CANCELLED' },
  });
  if (claimed.count === 0) {
    const existing = await prisma.stocktakeSession.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new ApiError('Stocktake session not found', 404);
    throw new ApiError('Only IN_PROGRESS stocktake sessions can be cancelled', 409);
  }
  const cancelled = await prisma.stocktakeSession.findUniqueOrThrow({
    where: { id },
    include: sessionDetailInclude,
  });
  return serializePrismaData(cancelled);
}
