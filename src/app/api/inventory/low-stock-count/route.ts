import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError, requireRole } from '@/lib/apiAuth';

export async function GET() {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { stockQuantity: true, lowStockThreshold: true },
    });

    const count = products.filter(
      (p) => p.stockQuantity <= p.lowStockThreshold
    ).length;

    return NextResponse.json({ count });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch low stock count');
  }
}
