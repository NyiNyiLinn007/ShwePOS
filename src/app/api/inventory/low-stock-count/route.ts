import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, requireRole } from '@/lib/apiAuth';

export async function GET() {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      SELECT COUNT(*)::int AS "count"
      FROM "Product"
      WHERE "isActive" = true AND "stockQuantity" <= "lowStockThreshold"
    `;
    const count = rows[0]?.count ?? 0;

    return NextResponse.json({ count });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch low stock count');
  }
}
