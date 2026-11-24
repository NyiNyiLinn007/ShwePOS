import prisma from '@/lib/prisma';
import { ApiError, AuthUser } from '@/lib/apiAuth';
import { CreatePurchaseOrderInput } from '@/lib/validations';
import { roundMoney, serializePrismaData, toNumber } from '@/lib/number';
import {
  getMyanmarDateCompact,
  isFractionalUnit,
  parseMyanmarDateBoundary,
  roundQuantity,
} from '@/lib/utils';
import { logAudit } from '@/services/auditService';

export interface ListPurchaseOrdersFilters {
  supplierId?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export async function listPurchaseOrders(filters: ListPurchaseOrdersFilters = {}) {
  const where: Record<string, unknown> = {};

  if (filters.supplierId) {
    where.supplierId = filters.supplierId;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.startDate || filters.endDate) {
    const createdAt: Record<string, Date> = {};
    if (filters.startDate) {
      const start = parseMyanmarDateBoundary(filters.startDate, false);
      if (start) createdAt.gte = start;
    }
    if (filters.endDate) {
      const end = parseMyanmarDateBoundary(filters.endDate, true);
      if (end) createdAt.lte = end;
    }
    if (Object.keys(createdAt).length > 0) {
      where.createdAt = createdAt;
    }
  }

  const orders = await prisma.purchaseOrder.findMany({
    where,
    include: {
      supplier: { select: { id: true, name: true, phone: true } },
      user: { select: { id: true, name: true } },
      items: {
        include: {
          product: {
            select: { id: true, name: true, nameMm: true, sku: true, unit: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return serializePrismaData(orders);
}

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
  user: AuthUser
) {
  const order = await prisma.$transaction(
    async (tx) => {
      const supplier = await tx.supplier.findUnique({
        where: { id: input.supplierId },
        select: { id: true, name: true, isActive: true },
      });

      if (!supplier || !supplier.isActive) {
        throw new ApiError('Selected supplier not found or inactive', 400);
      }

      const productIds = input.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          unit: true,
          stockQuantity: true,
          costPrice: true,
        },
      });
      const productMap = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      const preparedItems: Array<{
        productId: string;
        quantity: number;
        unitCost: number;
        total: number;
        batchNumber: string | null;
        expiryDate: Date | null;
      }> = [];

      for (const item of input.items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new ApiError(`Product not found: ${item.productId}`, 400);
        }
        const qty = roundQuantity(item.quantity);
        if (!isFractionalUnit(product.unit) && !Number.isInteger(qty)) {
          throw new ApiError(
            `Fractional quantity (${qty}) is not allowed for unit '${product.unit}' on ${product.name}`,
            400
          );
        }
        const unitCost = roundMoney(item.unitCost);
        const lineTotal = roundMoney(unitCost * qty);
        subtotal = roundMoney(subtotal + lineTotal);

        preparedItems.push({
          productId: product.id,
          quantity: qty,
          unitCost,
          total: lineTotal,
          batchNumber: item.batchNumber?.trim() || null,
          expiryDate: item.expiryDate
            ? (parseMyanmarDateBoundary(item.expiryDate, true) ?? new Date(item.expiryDate))
            : null,
        });
      }

      const discountAmount = roundMoney(Math.min(input.discountAmount || 0, subtotal));
      const totalAmount = roundMoney(Math.max(0, subtotal - discountAmount));
      const paidAmount =
        input.paidAmount !== undefined
          ? roundMoney(Math.min(Math.max(0, input.paidAmount), totalAmount))
          : input.paymentMethod === 'CREDIT'
            ? 0
            : totalAmount;
      const dueAmount = roundMoney(Math.max(0, totalAmount - paidAmount));

      // Atomic PO sequence in Myanmar timezone (PO-YYYYMMDD-XXXX)
      const dateStr = getMyanmarDateCompact();
      const counterKey = `PO-${dateStr}`;
      const counter = await tx.invoiceCounter.upsert({
        where: { date: counterKey },
        create: { date: counterKey, counter: 1 },
        update: { counter: { increment: 1 } },
      });
      const poNumber = `PO-${dateStr}-${counter.counter.toString().padStart(4, '0')}`;

      const createdPo = await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: supplier.id,
          userId: user.id,
          subtotal,
          discountAmount,
          totalAmount,
          paidAmount,
          dueAmount,
          paymentMethod: input.paymentMethod,
          status: 'RECEIVED',
          notes: input.notes?.trim() || null,
          items: {
            create: preparedItems,
          },
        },
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          user: { select: { id: true, name: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, nameMm: true, sku: true, unit: true },
              },
            },
          },
        },
      });

      // Apply stock increase + Latest Purchase Cost update + StockMovement IN
      for (const item of preparedItems) {
        const currentProduct = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockQuantity: true },
        });
        const previousStock = roundQuantity(toNumber(currentProduct?.stockQuantity));
        const newStock = roundQuantity(previousStock + item.quantity);

        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: newStock,
            costPrice: item.unitCost, // Latest Purchase Cost policy
            ...(item.batchNumber ? { batchNumber: item.batchNumber } : {}),
            ...(item.expiryDate ? { expiryDate: item.expiryDate } : {}),
          },
        });

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            userId: user.id,
            quantity: item.quantity,
            type: 'IN',
            reason: `Purchase Order: ${poNumber} (${supplier.name})`,
            previousStock,
            newStock,
          },
        });
      }

      if (dueAmount > 0) {
        await tx.supplier.update({
          where: { id: supplier.id },
          data: {
            creditBalance: { increment: dueAmount },
          },
        });
      }

      await logAudit(
        {
          userId: user.id,
          action: 'PURCHASE_ORDER_CREATED',
          entityType: 'PURCHASE_ORDER',
          entityId: createdPo.id,
          summary: `Received ${poNumber} from ${supplier.name} — Total: ${totalAmount} K (Paid: ${paidAmount} K, Due: ${dueAmount} K)`,
          metadata: {
            poNumber,
            supplierId: supplier.id,
            supplierName: supplier.name,
            itemCount: preparedItems.length,
            totalAmount,
            paidAmount,
            dueAmount,
            paymentMethod: input.paymentMethod,
          },
        },
        tx
      );

      return createdPo;
    },
    { maxWait: 10000, timeout: 15000 }
  );

  return serializePrismaData(order);
}

export async function cancelPurchaseOrder(id: string, user: AuthUser) {
  const cancelled = await prisma.$transaction(
    async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          supplier: { select: { id: true, name: true, creditBalance: true } },
          items: true,
        },
      });

      if (!po) {
        throw new ApiError('Purchase order not found', 404);
      }
      if (po.status === 'CANCELLED') {
        throw new ApiError('Purchase order is already cancelled', 409);
      }

      // Atomically claim RECEIVED -> CANCELLED FIRST to prevent concurrent double-decrement race
      const claimed = await tx.purchaseOrder.updateMany({
        where: { id, status: 'RECEIVED' },
        data: { status: 'CANCELLED', dueAmount: 0 },
      });
      if (claimed.count === 0) {
        throw new ApiError('Purchase order was already cancelled', 409);
      }

      for (const item of po.items) {
        const qty = roundQuantity(toNumber(item.quantity));
        const res = await tx.product.updateMany({
          where: { id: item.productId, stockQuantity: { gte: qty } },
          data: { stockQuantity: { decrement: qty } },
        });
        if (res.count === 0) {
          throw new ApiError(
            'Cannot cancel purchase order because received stock has already been sold or adjusted',
            409
          );
        }

        // Revert Product.costPrice to the most recent remaining RECEIVED PO item cost (if any)
        const prevPoItem = await tx.purchaseItem.findFirst({
          where: {
            productId: item.productId,
            purchaseOrder: { status: 'RECEIVED', id: { not: po.id } },
          },
          orderBy: { purchaseOrder: { createdAt: 'desc' } },
          select: { unitCost: true },
        });
        if (prevPoItem) {
          await tx.product.update({
            where: { id: item.productId },
            data: { costPrice: prevPoItem.unitCost },
          });
        }

        const updatedProduct = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockQuantity: true },
        });
        const newStock = roundQuantity(toNumber(updatedProduct?.stockQuantity));

        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            userId: user.id,
            quantity: qty,
            type: 'ADJUSTMENT',
            reason: `Cancelled PO: ${po.poNumber}`,
            previousStock: roundQuantity(newStock + qty),
            newStock,
          },
        });
      }

      const dueToReverse = roundMoney(
        Math.min(toNumber(po.supplier.creditBalance), toNumber(po.dueAmount))
      );
      if (dueToReverse > 0) {
        await tx.supplier.updateMany({
          where: { id: po.supplierId, creditBalance: { gte: dueToReverse } },
          data: { creditBalance: { decrement: dueToReverse } },
        });
      }

      const updatedPo = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id },
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          user: { select: { id: true, name: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, nameMm: true, sku: true, unit: true },
              },
            },
          },
        },
      });

      await logAudit(
        {
          userId: user.id,
          action: 'PURCHASE_ORDER_CANCELLED',
          entityType: 'PURCHASE_ORDER',
          entityId: po.id,
          summary: `Cancelled ${po.poNumber} (${po.supplier.name}) — Reversed stock & ${dueToReverse} K payable`,
          metadata: {
            poNumber: po.poNumber,
            supplierName: po.supplier.name,
            reversedPayable: dueToReverse,
          },
        },
        tx
      );

      return updatedPo;
    },
    { maxWait: 10000, timeout: 15000 }
  );

  return serializePrismaData(cancelled);
}
