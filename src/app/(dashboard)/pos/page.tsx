import prisma from '@/lib/prisma';
import POSClient from '@/components/pos/POSClient';
import { requirePageAuth } from '@/lib/pageAuth';
import { toNumber } from '@/lib/number';

export const metadata = {
  title: 'POS Terminal - ShwePOS',
};

export default async function POSPage() {
  const session = await requirePageAuth();
  const canViewCost = session.user.role === 'ADMIN' || session.user.role === 'MANAGER';

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
        productUnits: {
          orderBy: { conversionFactor: 'asc' },
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

  // Serialize for client component (costPrice exposed only to ADMIN/MANAGER for cost-floor warnings)
  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    nameMm: p.nameMm,
    sku: p.sku,
    barcode: p.barcode,
    sellingPrice: toNumber(p.sellingPrice),
    ...(canViewCost ? { costPrice: toNumber(p.costPrice) } : {}),
    stockQuantity: toNumber(p.stockQuantity),
    unit: p.unit,
    imageUrl: p.imageUrl,
    category: p.category,
    productUnits: p.productUnits.map((u) => ({
      id: u.id,
      productId: u.productId,
      unitName: u.unitName,
      nameMm: u.nameMm,
      conversionFactor: toNumber(u.conversionFactor),
      sellingPrice: toNumber(u.sellingPrice),
      barcode: u.barcode,
    })),
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
