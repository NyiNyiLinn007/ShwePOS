import prisma from '@/lib/prisma';
import POSClient from '@/components/pos/POSClient';

export const metadata = {
  title: 'POS Terminal - ShwePOS',
};

export default async function POSPage() {
  const [products, categories, settings] = await Promise.all([
    prisma.product.findMany({
      where: { isActive: true },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameMm: true,
          },
        },
      },
      orderBy: [
        { category: { name: 'asc' } },
        { name: 'asc' },
      ],
    }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    }),
    prisma.settings.findFirst({
      where: { id: 'default' },
    }),
  ]);

  const taxRate = settings?.taxRate ?? 0;

  // Serialize for client component (strip Date objects and sensitive fields)
  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    nameMm: p.nameMm,
    sku: p.sku,
    barcode: p.barcode,
    sellingPrice: p.sellingPrice,
    // costPrice intentionally excluded — sensitive margin data
    stockQuantity: p.stockQuantity,
    unit: p.unit,
    imageUrl: p.imageUrl,
    category: p.category,
  }));

  const serializedCategories = categories.map((c) => ({
    id: c.id,
    name: c.name,
    nameMm: c.nameMm,
    slug: c.slug,
  }));

  return (
    <POSClient
      initialProducts={serializedProducts}
      initialCategories={serializedCategories}
      taxRate={taxRate}
    />
  );
}
