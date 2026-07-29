import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { updateCustomerSchema } from '@/lib/validations';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          include: {
            items: {
              include: {
                product: {
                  select: { name: true, nameMm: true, sku: true },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...customer,
      totalPurchases: Number(customer.totalPurchases),
      sales: customer.sales.map((sale) => ({
        ...sale,
        totalAmount: Number(sale.totalAmount),
        items: sale.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          costPrice: Number(item.costPrice),
          discount: Number(item.discount),
          total: Number(item.total),
        })),
      })),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch customer');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;
    const parsed = updateCustomerSchema.parse(await request.json());
    const name = parsed.name?.trim();
    const phone = parsed.phone?.trim() || null;
    const email = parsed.email?.trim() || null;
    const address = parsed.address?.trim() || null;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    if (phone && phone !== existing.phone) {
      const phoneExists = await prisma.customer.findUnique({
        where: { phone },
      });
      if (phoneExists) {
        return NextResponse.json(
          { error: 'A customer with this phone number already exists' },
          { status: 409 }
        );
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: name || existing.name,
        phone,
        email,
        address,
      },
    });

    return NextResponse.json({ ...customer, totalPurchases: Number(customer.totalPurchases) });
  } catch (error) {
    return handleApiError(error, 'Failed to update customer');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(_request);
    await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;

    const existing = await prisma.customer.findUnique({
      where: { id },
      include: { sales: { select: { id: true }, take: 1 } },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    if (existing.sales.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete customer with existing sales. Consider updating their information instead.' },
        { status: 400 }
      );
    }

    await prisma.customer.delete({ where: { id } });

    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    return handleApiError(error, 'Failed to delete customer');
  }
}
