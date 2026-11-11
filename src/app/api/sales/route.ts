import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { createSaleSchema } from '@/lib/validations';
import { createSale, listSales } from '@/services/saleService';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);

    const result = await listSales(
      {
        startDate: searchParams.get('startDate'),
        endDate: searchParams.get('endDate'),
        status: searchParams.get('status'),
        paymentMethod: searchParams.get('paymentMethod'),
        page: parseInt(searchParams.get('page') || '1', 10),
        limit: parseInt(searchParams.get('limit') || '50', 10),
      },
      user
    );

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch sales');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const body = await request.json();

    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { sale, created } = await createSale(parsed.data, user);
    return NextResponse.json(sale, { status: created ? 201 : 200 });
  } catch (error) {
    return handleApiError(error, 'Failed to create sale');
  }
}
