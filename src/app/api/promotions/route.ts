import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireRole, validateCsrf } from '@/lib/apiAuth';
import { createPromotionSchema } from '@/lib/validations';
import { createPromotion, listPromotions } from '@/services/promotionService';

export async function GET() {
  try {
    await requireRole('MANAGER', 'ADMIN');
    const promos = await listPromotions();
    return NextResponse.json(promos, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch promotions');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');
    const parsed = createPromotionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const created = await createPromotion(parsed.data, user);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create promotion');
  }
}
