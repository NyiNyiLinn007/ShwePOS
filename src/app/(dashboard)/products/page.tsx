import prisma from '@/lib/prisma';
import { ProductsClient } from '@/components/products/ProductsClient';
import { requirePageRole } from '@/lib/pageAuth';
import { toNumber } from '@/lib/number';

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

  const serializedProducts = products.map((product) => ({
    ...product,
    costPrice: toNumber(product.costPrice),
    sellingPrice: toNumber(product.sellingPrice),
  }));

  return <ProductsClient initialProducts={serializedProducts} categories={categories} />;
}
