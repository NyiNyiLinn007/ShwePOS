import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';

    const where: Record<string, unknown> = {};

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        sales: {
          select: {
            id: true,
            totalAmount: true,
            createdAt: true,
            status: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = customers.map((customer) => {
      const completedSales = customer.sales.filter(
        (s) => s.status === 'COMPLETED'
      );
      const lastSale = customer.sales[0] || null;

      return {
        ...customer,
        purchaseCount: completedSales.length,
        lastPurchaseDate: lastSale?.createdAt || null,
        sales: undefined,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch customers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, phone, email, address } = body as {
      name: string;
      phone?: string;
      email?: string;
      address?: string;
    };

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      );
    }

    if (phone) {
      const existingPhone = await prisma.customer.findUnique({
        where: { phone },
      });
      if (existingPhone) {
        return NextResponse.json(
          { error: 'A customer with this phone number already exists' },
          { status: 409 }
        );
      }
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Failed to create customer:', error);
    return NextResponse.json(
      { error: 'Failed to create customer' },
      { status: 500 }
    );
  }
}
