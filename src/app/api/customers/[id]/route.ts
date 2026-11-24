import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { updateCustomerSchema } from '@/lib/validations';
import { serializePrismaData } from '@/lib/number';

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
        salePayments: {
          where: { type: 'DEBT_REPAYMENT' },
          orderBy: { createdAt: 'desc' },
          take: 25,
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(serializePrismaData(customer), { headers: { 'Cache-Control': 'no-store' } });
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
    const name = parsed.name !== undefined ? parsed.name.trim() : undefined;
    const phone = parsed.phone !== undefined ? parsed.phone?.trim() || null : undefined;
    const email = parsed.email !== undefined ? parsed.email?.trim() || null : undefined;
    const address = parsed.address !== undefined ? parsed.address?.trim() || null : undefined;

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
        ...(name !== undefined && { name: name || existing.name }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(address !== undefined && { address }),
        ...(parsed.creditLimit !== undefined && {
          creditLimit:
            parsed.creditLimit !== null && parsed.creditLimit > 0 ? parsed.creditLimit : null,
        }),
      },
    });

    return NextResponse.json(serializePrismaData(customer));
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
    await requireRole('ADMIN');

    const { id } = await params;

    const existing = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: { select: { id: true }, take: 1 },
        salePayments: { select: { id: true }, take: 1 },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Customer not found' },
        { status: 404 }
      );
    }

    if (
      existing.sales.length > 0 ||
      Number(existing.creditBalance) > 0 ||
      existing.salePayments.length > 0
    ) {
      return NextResponse.json(
        {
          error:
            'Cannot delete customer with existing sales, repayments, or outstanding credit balance.',
        },
        { status: 400 }
      );
    }

    await prisma.customer.delete({ where: { id } });

    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    return handleApiError(error, 'Failed to delete customer');
  }
}
