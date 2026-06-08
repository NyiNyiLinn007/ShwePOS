import prisma from '@/lib/prisma';
import { ProductsClient } from '@/components/products/ProductsClient';
import { requirePageRole } from '@/lib/pageAuth';

export default async function ProductsPage() {
  await requirePageRole('MANAGER', 'ADMIN');

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameMm: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <ProductsClient initialProducts={products} categories={categories} />;
}
