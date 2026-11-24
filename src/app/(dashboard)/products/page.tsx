import prisma from '@/lib/prisma';
import { ProductsClient } from '@/components/products/ProductsClient';
import { requirePageRole } from '@/lib/pageAuth';
import { toNumber } from '@/lib/number';

export default async function ProductsPage() {
  const session = await requirePageRole('MANAGER', 'ADMIN');

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
        productUnits: {
          orderBy: { conversionFactor: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.category.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    }),
  ]);

  const serializedProducts = products.map((product) => ({
    ...product,
    costPrice: toNumber(product.costPrice),
    sellingPrice: toNumber(product.sellingPrice),
    stockQuantity: toNumber(product.stockQuantity),
    lowStockThreshold: toNumber(product.lowStockThreshold),
    expiryDate: product.expiryDate ? product.expiryDate.toISOString() : null,
    productUnits: product.productUnits.map((u) => ({
      id: u.id,
      productId: u.productId,
      unitName: u.unitName,
      nameMm: u.nameMm,
      conversionFactor: toNumber(u.conversionFactor),
      sellingPrice: toNumber(u.sellingPrice),
      barcode: u.barcode,
    })),
  }));

  return (
    <ProductsClient
      initialProducts={serializedProducts}
      categories={categories}
      userRole={session.user.role}
    />
  );
}
