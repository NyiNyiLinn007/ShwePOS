import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError } from '@/lib/apiAuth';
import { listAuditLogs } from '@/services/auditService';

export async function GET(request: NextRequest) {
  try {
    await requireRole('ADMIN');
    const { searchParams } = request.nextUrl;

    const result = await listAuditLogs({
      startDate: searchParams.get('startDate'),
      endDate: searchParams.get('endDate'),
      action: searchParams.get('action'),
      entityType: searchParams.get('entityType'),
      userId: searchParams.get('userId'),
      search: searchParams.get('search'),
      page: parseInt(searchParams.get('page') || '1', 10) || 1,
      limit: parseInt(searchParams.get('limit') || '50', 10) || 50,
    });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch audit logs');
  }
}
