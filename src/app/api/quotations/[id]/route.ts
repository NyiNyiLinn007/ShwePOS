import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireAuth, validateCsrf } from '@/lib/apiAuth';
import { updateQuotationSchema } from '@/lib/validations';
import { deleteQuotation, updateQuotation } from '@/services/quotationService';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    await requireAuth();
    const { id } = await params;
    const parsed = updateQuotationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const updated = await updateQuotation(id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Failed to update quotation');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    await requireAuth();
    const { id } = await params;
    const cancelled = await deleteQuotation(id);
    return NextResponse.json(cancelled);
  } catch (error) {
    return handleApiError(error, 'Failed to cancel quotation');
  }
}
