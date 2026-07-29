import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { createCustomerSchema } from '@/lib/validations';

const MAX_SEARCH_LENGTH = 100;

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const searchParams = request.nextUrl.searchParams;
    const search = (searchParams.get('search') || '').trim().slice(0, MAX_SEARCH_LENGTH);
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(20, Math.max(1, Number.parseInt(searchParams.get('limit') || '10', 10) || 10));
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { phone: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {};

    // Cashier POS search only needs a minimal customer identity. Full PII and
    // purchase history remain manager/admin-only.
    if (user.role === 'CASHIER') {
      const customers = await prisma.customer.findMany({
        where,
        select: { id: true, name: true, phone: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return NextResponse.json(customers, { headers: { 'Cache-Control': 'no-store' } });
    }

    const customers = await prisma.customer.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        address: true,
        totalPurchases: true,
        loyaltyPoints: true,
        createdAt: true,
        updatedAt: true,
        sales: {
          select: { id: true, totalAmount: true, createdAt: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const result = customers.map((customer) => {
      const completedSales = customer.sales.filter((sale) => sale.status === 'COMPLETED');
      const lastSale = customer.sales[0] || null;
      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        totalPurchases: Number(customer.totalPurchases),
        loyaltyPoints: customer.loyaltyPoints,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        purchaseCount: completedSales.length,
        lastPurchaseDate: lastSale?.createdAt || null,
        sales: undefined,
      };
    });

    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch customers');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    await requireRole('MANAGER', 'ADMIN');

    const parsed = createCustomerSchema.parse(await request.json());
    const name = parsed.name.trim();
    const phone = parsed.phone?.trim() || null;

    if (phone) {
      const existingPhone = await prisma.customer.findUnique({ where: { phone } });
      if (existingPhone) {
        return NextResponse.json(
          { error: 'A customer with this phone number already exists' },
          { status: 409 }
        );
      }
    }

    const customer = await prisma.customer.create({
      data: {
        name,
        phone,
        email: parsed.email?.trim() || null,
        address: parsed.address?.trim() || null,
      },
    });

    return NextResponse.json({ ...customer, totalPurchases: Number(customer.totalPurchases) }, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create customer');
  }
}
