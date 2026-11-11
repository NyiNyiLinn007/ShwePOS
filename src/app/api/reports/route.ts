import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/apiAuth';
import { generateSalesAndProfitReport } from '@/services/reportService';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const report = await generateSalesAndProfitReport(startDate, endDate);
    return NextResponse.json(report);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch report data');
  }
}
