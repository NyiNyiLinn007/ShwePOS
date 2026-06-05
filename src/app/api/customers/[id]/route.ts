import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Failed to fetch customer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer' },
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
    const { name, phone, email, address } = body as {
      name?: string;
      phone?: string;
      email?: string;
      address?: string;
    };

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
        name: name?.trim() || existing.name,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error('Failed to update customer:', error);
    return NextResponse.json(
      { error: 'Failed to update customer' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    console.error('Failed to delete customer:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer' },
      { status: 500 }
    );
  }
}
