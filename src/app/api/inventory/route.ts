import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApiError, requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { inventoryMovementSchema } from '@/lib/validations';
import { serializePrismaData, toNumber } from '@/lib/number';
import { isFractionalUnit, parseMyanmarDateBoundary, roundQuantity } from '@/lib/utils';
import { logAudit } from '@/services/auditService';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const productId = searchParams.get('productId');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));

    const where: Record<string, unknown> = {};

    if (type) {
      where.type = type;
    }

    if (productId) {
      where.productId = productId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = parseMyanmarDateBoundary(startDate, false);
        if (start) (where.createdAt as Record<string, unknown>).gte = start;
      }
      if (endDate) {
        const end = parseMyanmarDateBoundary(endDate, true);
        if (end) (where.createdAt as Record<string, unknown>).lte = end;
      }
    }

    const [movements, total] = await Promise.all([
      prisma.stockMovement.findMany({
        where,
        include: {
          product: {
            select: { id: true, name: true, nameMm: true, sku: true, unit: true },
          },
          user: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return NextResponse.json({
      movements: serializePrismaData(movements),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch stock movements');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');

    const body = await request.json();
    const parsed = inventoryMovementSchema.parse(body);
    const { productId, quantity: rawQuantity, type, reason } = parsed;
    const quantity = roundQuantity(rawQuantity);

    if ((type === 'IN' || type === 'OUT' || type === 'RETURN') && quantity <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than zero' }, { status: 400 });
    }

    const movement = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new ApiError('Product not found', 404);
      }

      if (!isFractionalUnit(product.unit) && !Number.isInteger(quantity)) {
        throw new ApiError(
          `Fractional quantity (${quantity}) is not allowed for unit '${product.unit}' on ${product.name}`,
          400
        );
      }

      let previousStock = roundQuantity(toNumber(product.stockQuantity));
      let newStock: number;

      switch (type) {
        case 'IN':
        case 'RETURN': {
          const updated = await tx.product.update({
            where: { id: productId },
            data: { stockQuantity: { increment: quantity } },
            select: { stockQuantity: true },
          });
          newStock = roundQuantity(toNumber(updated.stockQuantity));
          previousStock = roundQuantity(newStock - quantity);
          break;
        }
        case 'OUT': {
          const outResult = await tx.product.updateMany({
            where: { id: productId, stockQuantity: { gte: quantity } },
            data: { stockQuantity: { decrement: quantity } },
          });
          if (outResult.count === 0) {
            throw new ApiError(
              `Insufficient stock. Current: ${previousStock}, Requested: ${quantity}`,
              409
            );
          }
          const updated = await tx.product.findUniqueOrThrow({
            where: { id: productId },
            select: { stockQuantity: true },
          });
          newStock = roundQuantity(toNumber(updated.stockQuantity));
          previousStock = roundQuantity(newStock + quantity);
          break;
        }
        case 'ADJUSTMENT': {
          newStock = roundQuantity(quantity);
          await tx.product.update({
            where: { id: productId },
            data: { stockQuantity: newStock },
          });
          break;
        }
        default:
          throw new ApiError('Invalid movement type', 400);
      }

      const created = await tx.stockMovement.create({
        data: {
          productId,
          userId: user.id,
          quantity,
          type,
          reason: reason || null,
          previousStock,
          newStock,
        },
        include: {
          product: {
            select: { id: true, name: true, nameMm: true, sku: true, unit: true },
          },
          user: {
            select: { id: true, name: true },
          },
        },
      });

      await logAudit(
        {
          userId: user.id,
          action: 'STOCK_ADJUSTMENT',
          entityType: 'INVENTORY',
          entityId: productId,
          summary: `Stock ${type} for ${product.name}: ${previousStock} -> ${newStock} ${product.unit} (${reason})`,
          metadata: {
            productName: product.name,
            type,
            quantity,
            previousStock,
            newStock,
            reason,
          },
        },
        tx
      );

      return created;
    });

    return NextResponse.json(serializePrismaData(movement), { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create stock movement');
  }
}
