import { NextResponse } from 'next/server';
import { handleApiError, requireRole } from '@/lib/apiAuth';
import { generateArApAgingReport } from '@/services/agingService';

export async function GET() {
  try {
    await requireRole('MANAGER', 'ADMIN');
    const report = await generateArApAgingReport();
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Failed to generate AR/AP aging report');
  }
}
