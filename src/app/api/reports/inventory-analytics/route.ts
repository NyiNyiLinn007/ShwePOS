import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireRole } from '@/lib/apiAuth';
import { generateInventoryAnalytics } from '@/services/inventoryAnalyticsService';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');
    const sp = request.nextUrl.searchParams;
    const report = await generateInventoryAnalytics({
      deadDays: Number.parseInt(sp.get('deadDays') || '30', 10) || 30,
      velocityDays: Number.parseInt(sp.get('velocityDays') || '30', 10) || 30,
      leadDays: Number.parseInt(sp.get('leadDays') || '14', 10) || 14,
    });
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Failed to generate inventory analytics');
  }
}
