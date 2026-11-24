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
            { name: { contains: search, mode: 'insensitive' as const } },
            { phone: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    // Cashier POS search needs customer identity, loyalty points, and credit state.
    if (user.role === 'CASHIER') {
      const customers = await prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          phone: true,
          loyaltyPoints: true,
          creditBalance: true,
          creditLimit: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      });
      return NextResponse.json(
        customers.map((c) => ({
          ...c,
          creditBalance: Number(c.creditBalance),
          creditLimit: c.creditLimit !== null ? Number(c.creditLimit) : null,
        })),
        { headers: { 'Cache-Control': 'no-store' } }
      );
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
        creditBalance: true,
        creditLimit: true,
        loyaltyPoints: true,
        createdAt: true,
        updatedAt: true,
        sales: {
          where: { status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } },
          select: { createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const customerIds = customers.map((c) => c.id);
    const purchaseCounts =
      customerIds.length > 0
        ? await prisma.sale.groupBy({
            by: ['customerId'],
            where: {
              customerId: { in: customerIds },
              status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
            },
            _count: { id: true },
          })
        : [];
    const purchaseCountMap = new Map<string, number>();
    for (const row of purchaseCounts) {
      if (row.customerId) {
        purchaseCountMap.set(row.customerId, row._count.id);
      }
    }

    const result = customers.map((customer) => {
      const lastSale = customer.sales[0] || null;
      return {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
        address: customer.address,
        totalPurchases: Number(customer.totalPurchases),
        creditBalance: Number(customer.creditBalance),
        creditLimit: customer.creditLimit !== null ? Number(customer.creditLimit) : null,
        loyaltyPoints: customer.loyaltyPoints,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
        purchaseCount: purchaseCountMap.get(customer.id) ?? 0,
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
    // Allow CASHIER, MANAGER, and ADMIN to register new customers at POS
    const user = await requireAuth();

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
        creditLimit:
          user.role !== 'CASHIER' && parsed.creditLimit !== undefined && parsed.creditLimit !== null && parsed.creditLimit > 0
            ? parsed.creditLimit
            : null,
      },
    });

    return NextResponse.json(
      {
        ...customer,
        totalPurchases: Number(customer.totalPurchases),
        creditBalance: Number(customer.creditBalance),
        creditLimit: customer.creditLimit !== null ? Number(customer.creditLimit) : null,
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'Failed to create customer');
  }
}
