import prisma from '@/lib/prisma';
import { InventoryClient } from '@/components/inventory/InventoryClient';
import { requirePageRole } from '@/lib/pageAuth';

export default async function InventoryPage() {
  await requirePageRole('MANAGER', 'ADMIN');

  const [products, recentMovements] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nameMm: true,
        sku: true,
        stockQuantity: true,
        lowStockThreshold: true,
        unit: true,
        imageUrl: true,
        isActive: true,
        category: {
          select: { id: true, name: true, nameMm: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.stockMovement.findMany({
      include: {
        product: {
          select: { id: true, name: true, nameMm: true, sku: true, unit: true },
        },
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);

  return (
    <InventoryClient
      initialProducts={products}
      initialMovements={recentMovements}
    />
  );
}
