import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireRole, validateCsrf } from '@/lib/apiAuth';
import { updatePromotionSchema } from '@/lib/validations';
import { deletePromotion, updatePromotion } from '@/services/promotionService';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');
    const { id } = await params;
    const parsed = updatePromotionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const updated = await updatePromotion(id, parsed.data, user);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Failed to update promotion');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    await requireRole('MANAGER', 'ADMIN');
    const { id } = await params;
    const result = await deletePromotion(id);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'Failed to delete promotion');
  }
}
