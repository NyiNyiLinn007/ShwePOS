import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireRole, validateCsrf } from '@/lib/apiAuth';
import { updateStocktakeItemsSchema } from '@/lib/validations';
import {
  cancelStocktakeSession,
  getStocktakeSession,
  updateStocktakeItems,
} from '@/services/stocktakeService';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('MANAGER', 'ADMIN');
    const { id } = await params;
    const session = await getStocktakeSession(id);
    return NextResponse.json(session, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch stocktake session');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    await requireRole('MANAGER', 'ADMIN');
    const { id } = await params;
    const parsed = updateStocktakeItemsSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const updated = await updateStocktakeItems(id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Failed to save stocktake counts');
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
    const cancelled = await cancelStocktakeSession(id);
    return NextResponse.json(cancelled);
  } catch (error) {
    return handleApiError(error, 'Failed to cancel stocktake session');
  }
}
