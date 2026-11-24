import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireRole, validateCsrf } from '@/lib/apiAuth';
import { createStocktakeSchema } from '@/lib/validations';
import { createStocktakeSession, listStocktakeSessions } from '@/services/stocktakeService';

export async function GET() {
  try {
    await requireRole('MANAGER', 'ADMIN');
    const sessions = await listStocktakeSessions();
    return NextResponse.json(sessions, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch stocktake sessions');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');
    const parsed = createStocktakeSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const created = await createStocktakeSession(parsed.data, user);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create stocktake session');
  }
}
