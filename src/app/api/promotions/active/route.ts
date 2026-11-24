import { NextResponse } from 'next/server';
import { handleApiError, requireAuth } from '@/lib/apiAuth';
import { listActivePromotions } from '@/services/promotionService';

export async function GET() {
  try {
    await requireAuth();
    const promos = await listActivePromotions();
    return NextResponse.json(promos, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch active promotions');
  }
}
