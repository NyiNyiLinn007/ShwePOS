import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, requireRole, handleApiError, ApiError } from '@/lib/apiAuth';
import { updateSaleStatusSchema } from '@/lib/validations';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
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
    // Only MANAGER and ADMIN can refund/void
    const user = await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;
    const body = await request.json();

    // Zod validation — require status + reason
    const parsed = updateSaleStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { status: newStatus, reason } = parsed.data;

    const existingSale = await prisma.sale.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!existingSale) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      );
    }

    // State machine: only COMPLETED can transition to REFUNDED or VOIDED
    if (existingSale.status !== 'COMPLETED') {
      return NextResponse.json(
        {
          error: `Cannot ${newStatus.toLowerCase()} a sale with status "${existingSale.status}". Only COMPLETED sales can be refunded or voided.`,
        },
        { status: 400 }
      );
    }

    const updatedSale = await prisma.$transaction(async (tx) => {
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

      // Update sale status with reason and user audit
      return tx.sale.update({
        where: { id },
        data: {
          status: newStatus,
          notes: `[${newStatus} by ${user.name}] ${reason}${existingSale.notes ? `\n---\n${existingSale.notes}` : ''}`,
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
    }, { maxWait: 10000, timeout: 15000 });

    return NextResponse.json(updatedSale);
  } catch (error) {
    return handleApiError(error, 'Failed to update sale');
  }
}
