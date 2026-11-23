import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { createPurchaseOrderSchema } from '@/lib/validations';
import { createPurchaseOrder, listPurchaseOrders } from '@/services/purchaseService';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');
    const { searchParams } = request.nextUrl;
    const orders = await listPurchaseOrders({
      supplierId: searchParams.get('supplierId'),
      status: searchParams.get('status'),
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
    });
    return NextResponse.json(orders);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch purchase orders');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');
    const parsed = createPurchaseOrderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const order = await createPurchaseOrder(parsed.data, user);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create purchase order');
  }
}
