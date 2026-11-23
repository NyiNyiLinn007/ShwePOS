import prisma from '@/lib/prisma';
import { requirePageRole } from '@/lib/pageAuth';
import { toNumber } from '@/lib/number';
import { listPurchaseOrders } from '@/services/purchaseService';
import { PurchasesClient } from '@/components/purchases/PurchasesClient';

export const metadata = {
  title: 'Purchase Orders - ShwePOS',
};

export default async function PurchasesPage() {
  await requirePageRole('MANAGER', 'ADMIN');

  const [orders, suppliers, products] = await Promise.all([
    listPurchaseOrders(),
    prisma.supplier.findMany({
      where: { isActive: true },
      select: { id: true, name: true, phone: true },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        nameMm: true,
        sku: true,
        unit: true,
        costPrice: true,
        stockQuantity: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const serializedProducts = products.map((p) => ({
    ...p,
    costPrice: toNumber(p.costPrice),
    stockQuantity: toNumber(p.stockQuantity),
  }));

  return (
    <PurchasesClient
      initialOrders={orders as Parameters<typeof PurchasesClient>[0]['initialOrders']}
      suppliers={suppliers}
      products={serializedProducts}
    />
  );
}
