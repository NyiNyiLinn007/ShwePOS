import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, requireRole, handleApiError, ApiError, validateCsrf } from '@/lib/apiAuth';
import { updateSaleStatusSchema } from '@/lib/validations';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                nameMm: true,
                sku: true,
                barcode: true,
              },
            },
          },
        },
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        user: {
          select: { id: true, name: true },
        },
      },
    });

    if (!sale) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      );
    }

    // Cashier can only view their own sales
    if (user.role === 'CASHIER' && sale.userId !== user.id) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch sale');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);

    const user = await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;
    const body = await request.json();

    const parsed = updateSaleStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { status: newStatus, reason } = parsed.data;

    const updatedSale = await prisma.$transaction(async (tx) => {
      // Optimistic lock: atomically transition COMPLETED → target status
      // If another request already changed the status, count will be 0
      const transitioned = await tx.sale.updateMany({
        where: { id, status: 'COMPLETED' },
        data: {
          status: newStatus,
          notes: `[${newStatus} by ${user.name}] ${reason}`,
        },
      });

      if (transitioned.count === 0) {
        // Either sale doesn't exist or already processed
        const existing = await tx.sale.findUnique({ where: { id }, select: { status: true } });
        if (!existing) {
          throw new ApiError('Sale not found', 404);
        }
        throw new ApiError(
          `Cannot ${newStatus.toLowerCase()} — sale is already ${existing.status}`,
          409
        );
      }

      // Fetch sale with items for stock restore
      const existingSale = await tx.sale.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existingSale) {
        throw new ApiError('Sale not found', 404);
      }

      await tx.saleAdjustment.create({
        data: {
          saleId: existingSale.id,
          approverUserId: user.id,
          type: newStatus === 'REFUNDED' ? 'REFUND' : 'VOID',
          reason,
          amount: existingSale.totalAmount,
          paymentMethod: existingSale.paymentMethod,
          paymentReversalStatus:
            existingSale.paymentMethod === 'CASH' ? 'COMPLETED' : 'PENDING',
        },
      });

      // Restore stock for each item
      for (const item of existingSale.items) {
        // Atomic stock increment
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQuantity: { increment: item.quantity },
          },
        });

        // Get updated product for stock movement record
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: { stockQuantity: true },
        });

        // Create StockMovement for the return
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            userId: user.id,
            saleId: existingSale.id,
            quantity: item.quantity,
            type: 'RETURN',
            reason: `${newStatus}: ${reason} (Invoice: ${existingSale.invoiceNumber})`,
            previousStock: (product?.stockQuantity ?? 0) - item.quantity,
            newStock: product?.stockQuantity ?? 0,
          },
        });
      }

      // Reverse customer purchase total
      if (existingSale.customerId) {
        await tx.customer.update({
          where: { id: existingSale.customerId },
          data: {
            totalPurchases: { decrement: existingSale.totalAmount },
          },
        });
      }

      if (existingSale.paymentMethod === 'CASH') {
        const openShift = await tx.shift.findFirst({
          where: { userId: existingSale.userId, status: 'OPEN' },
          select: { id: true },
          orderBy: { openedAt: 'desc' },
        });

        await tx.cashDrawerMovement.create({
          data: {
            shiftId: openShift?.id ?? null,
            saleId: existingSale.id,
            userId: user.id,
            type: newStatus === 'REFUNDED' ? 'REFUND' : 'VOID',
            amount: -existingSale.totalAmount,
            reason: `${newStatus}: ${reason} (Invoice: ${existingSale.invoiceNumber})`,
          },
        });
      }

      // Fetch updated sale with full includes for response
      const finalSale = await tx.sale.findUnique({
        where: { id },
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

      return finalSale;
    }, { maxWait: 10000, timeout: 15000 });

    return NextResponse.json(updatedSale);
  } catch (error) {
    return handleApiError(error, 'Failed to update sale');
  }
}
