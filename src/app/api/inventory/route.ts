import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
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
    console.error('Failed to fetch stock movements:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock movements' },
      { status: 500 }
    );
  }
}

interface CreateMovementBody {
  productId: string;
  quantity: number;
  type: 'IN' | 'OUT' | 'ADJUSTMENT' | 'RETURN';
  reason?: string;
  userId: string;
}

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from session
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body: CreateMovementBody = await request.json();
    const { productId, quantity, type, reason } = body;

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      );
    }

    if (!quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Quantity must be a positive number' },
        { status: 400 }
      );
    }

    if (!type || !['IN', 'OUT', 'ADJUSTMENT', 'RETURN'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid movement type' },
        { status: 400 }
      );
    }

    const effectiveUserId = session.user.id;

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
        case 'RETURN':
          newStock = previousStock + quantity;
          break;
        case 'OUT':
          if (previousStock < quantity) {
            throw new Error(
              `Insufficient stock. Current: ${previousStock}, Requested: ${quantity}`
            );
          }
          newStock = previousStock - quantity;
          break;
        case 'ADJUSTMENT':
          newStock = quantity;
          break;
        default:
          throw new Error('Invalid movement type');
      }

      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: newStock },
      });

      const created = await tx.stockMovement.create({
        data: {
          productId,
          userId: effectiveUserId,
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
    console.error('Failed to create stock movement:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create stock movement';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
