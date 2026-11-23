import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { cancelPurchaseOrder } from '@/services/purchaseService';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');
    const { id } = await params;

    const cancelled = await cancelPurchaseOrder(id, user);
    return NextResponse.json(cancelled);
  } catch (error) {
    return handleApiError(error, 'Failed to cancel purchase order');
  }
}
