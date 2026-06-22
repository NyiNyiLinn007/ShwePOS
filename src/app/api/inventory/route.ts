import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { inventoryMovementSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const productId = searchParams.get('productId');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

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
        (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        (where.createdAt as Record<string, unknown>).lte = end;
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
      movements,
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
    const { productId, quantity, type, reason } = parsed;

    const movement = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error('Product not found');
      }

      const previousStock = product.stockQuantity;
      let newStock: number;

      switch (type) {
        case 'IN':
        case 'RETURN': {
          newStock = previousStock + quantity;
          await tx.product.update({
            where: { id: productId },
            data: { stockQuantity: { increment: quantity } },
          });
          break;
        }
        case 'OUT': {
          const outResult = await tx.product.updateMany({
            where: { id: productId, stockQuantity: { gte: quantity } },
            data: { stockQuantity: { decrement: quantity } },
          });
          if (outResult.count === 0) {
            throw new Error(
              `Insufficient stock. Current: ${previousStock}, Requested: ${quantity}`
            );
          }
          newStock = previousStock - quantity;
          break;
        }
        case 'ADJUSTMENT': {
          newStock = quantity;
          await tx.product.update({
            where: { id: productId },
            data: { stockQuantity: newStock },
          });
          break;
        }
        default:
          throw new Error('Invalid movement type');
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

      return created;
    });

    return NextResponse.json(movement, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create stock movement');
  }
}
