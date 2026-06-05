import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const paymentMethod = searchParams.get('paymentMethod');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where: Record<string, unknown> = {};

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

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          items: {
            include: {
              product: {
                select: { name: true, nameMm: true, sku: true },
              },
            },
          },
          customer: {
            select: { id: true, name: true, phone: true },
          },
          user: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return NextResponse.json({
      sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch sales:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sales' },
      { status: 500 }
    );
  }
}

interface SaleItemInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
}

interface CreateSaleBody {
  items: SaleItemInput[];
  customerId?: string | null;
  userId: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  notes?: string;
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
    const userId = session.user.id;

    const body: CreateSaleBody = await request.json();

    const {
      items,
      customerId,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      paidAmount,
      changeAmount,
      paymentMethod,
      notes,
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'Sale must have at least one item' },
        { status: 400 }
      );
    }

    // Generate invoice number: INV-YYYYMMDD-XXXX
    const today = new Date();
    const dateStr =
      today.getFullYear().toString() +
      (today.getMonth() + 1).toString().padStart(2, '0') +
      today.getDate().toString().padStart(2, '0');

    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const todaySaleCount = await prisma.sale.count({
      where: {
        createdAt: {
          gte: todayStart,
          lt: todayEnd,
        },
      },
    });

    const invoiceNumber = `INV-${dateStr}-${(todaySaleCount + 1).toString().padStart(4, '0')}`;

    // Create sale with items and update stock in a transaction
    const sale = await prisma.$transaction(async (tx) => {
      // Verify stock availability for all items
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockQuantity: true, name: true },
        });

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`);
        }

        if (product.stockQuantity < item.quantity) {
          throw new Error(
            `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}, Requested: ${item.quantity}`
          );
        }
      }

      // Create the sale
      const newSale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: customerId || null,
          userId,
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          paidAmount,
          changeAmount,
          paymentMethod,
          notes: notes || null,
          status: 'COMPLETED',
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount || 0,
              total: item.unitPrice * item.quantity - (item.discount || 0),
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { name: true, nameMm: true, sku: true },
              },
            },
          },
          customer: {
            select: { id: true, name: true, phone: true },
          },
          user: {
            select: { id: true, name: true },
          },
        },
      });

      // Update product stock quantities
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: {
              decrement: item.quantity,
            },
          },
        });
      }

      // Update customer total purchases if customer selected
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalPurchases: {
              increment: totalAmount,
            },
          },
        });
      }

      return newSale;
    });

    return NextResponse.json(sale, { status: 201 });
  } catch (error) {
    console.error('Failed to create sale:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create sale';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
