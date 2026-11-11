import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { updateSaleStatusSchema } from '@/lib/validations';
import { getSaleById, refundOrVoidSale } from '@/services/saleService';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const sale = await getSaleById(id, user);
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

    const updatedSale = await refundOrVoidSale(id, parsed.data, user);
    return NextResponse.json(updatedSale);
  } catch (error) {
    return handleApiError(error, 'Failed to update sale');
  }
}
