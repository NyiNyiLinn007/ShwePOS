import prisma from '@/lib/prisma';
import { requirePageRole } from '@/lib/pageAuth';
import { listPromotions } from '@/services/promotionService';
import { PromotionsClient } from '@/components/promotions/PromotionsClient';

export const dynamic = 'force-dynamic';

export default async function PromotionsPage() {
  await requirePageRole('MANAGER', 'ADMIN');

  const [promotions, categories, products] = await Promise.all([
    listPromotions(),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameMm: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameMm: true, sku: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <PromotionsClient
      initialPromotions={promotions}
      categories={categories}
      products={products}
    />
  );
}
