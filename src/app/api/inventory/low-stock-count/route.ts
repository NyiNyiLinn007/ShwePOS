import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: { stockQuantity: true, lowStockThreshold: true },
    });

    const count = products.filter(
      (p) => p.stockQuantity <= p.lowStockThreshold
    ).length;

    return NextResponse.json({ count });
  } catch (error) {
    console.error('Low stock count error:', error);
    return NextResponse.json({ count: 0 });
  }
}
