import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    console.error('Failed to fetch sale:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sale' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body as { status: string };

    const validStatuses = ['COMPLETED', 'REFUNDED', 'VOIDED'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

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

    // If refunding or voiding, restore stock
    const shouldRestoreStock =
      existingSale.status === 'COMPLETED' &&
      (status === 'REFUNDED' || status === 'VOIDED');

    const updatedSale = await prisma.$transaction(async (tx) => {
      if (shouldRestoreStock) {
        for (const item of existingSale.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: {
                increment: item.quantity,
              },
            },
          });
        }

        // Reverse customer purchase total if customer exists
        if (existingSale.customerId) {
          await tx.customer.update({
            where: { id: existingSale.customerId },
            data: {
              totalPurchases: {
                decrement: existingSale.totalAmount,
              },
            },
          });
        }
      }

      return tx.sale.update({
        where: { id },
        data: { status },
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
    });

    return NextResponse.json(updatedSale);
  } catch (error) {
    console.error('Failed to update sale:', error);
    return NextResponse.json(
      { error: 'Failed to update sale' },
      { status: 500 }
    );
  }
}
