import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireRole } from '@/lib/apiAuth';
import { generateCashierPerformanceReport } from '@/services/cashierAnalyticsService';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');
    const sp = request.nextUrl.searchParams;
    const report = await generateCashierPerformanceReport({
      startDate: sp.get('startDate'),
      endDate: sp.get('endDate'),
    });
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Failed to generate cashier performance report');
  }
}
