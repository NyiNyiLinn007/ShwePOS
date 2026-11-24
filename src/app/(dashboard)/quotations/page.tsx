import prisma from '@/lib/prisma';
import { requirePageAuth } from '@/lib/pageAuth';
import { toNumber } from '@/lib/number';
import { listQuotations } from '@/services/quotationService';
import { QuotationsClient } from '@/components/quotations/QuotationsClient';

export const dynamic = 'force-dynamic';

export default async function QuotationsPage() {
  await requirePageAuth();

  const [quotations, customers, products, settings] = await Promise.all([
    listQuotations(),
    prisma.customer.findMany({
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      include: {
        productUnits: { orderBy: { conversionFactor: 'asc' } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.settings.findFirst({ where: { id: 'default' } }),
  ]);

  const serializedProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    nameMm: p.nameMm,
    sku: p.sku,
    unit: p.unit,
    categoryId: p.categoryId,
    imageUrl: p.imageUrl,
    sellingPrice: toNumber(p.sellingPrice),
    stockQuantity: toNumber(p.stockQuantity),
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

  return (
    <QuotationsClient
      initialQuotations={quotations}
      customers={customers}
      products={serializedProducts}
      defaultTaxRate={settings?.taxRate ?? 0}
    />
  );
}
