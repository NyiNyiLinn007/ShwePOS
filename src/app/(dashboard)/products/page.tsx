import prisma from '@/lib/prisma';
import { ProductsClient } from '@/components/products/ProductsClient';

export default async function ProductsPage() {
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
