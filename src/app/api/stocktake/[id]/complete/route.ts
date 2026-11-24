import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireRole, validateCsrf } from '@/lib/apiAuth';
import { completeStocktakeSchema } from '@/lib/validations';
import { completeStocktakeSession } from '@/services/stocktakeService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = completeStocktakeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const completed = await completeStocktakeSession(id, parsed.data, user);
    return NextResponse.json(completed);
  } catch (error) {
    return handleApiError(error, 'Failed to complete stocktake session');
  }
}
