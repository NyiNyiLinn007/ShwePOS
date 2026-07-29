import prisma from '@/lib/prisma';
import { SalesClient } from '@/components/sales/SalesClient';
import { requirePageRole } from '@/lib/pageAuth';
import { toNumber } from '@/lib/number';

export default async function SalesPage() {
  await requirePageRole('MANAGER', 'ADMIN');

  const sales = await prisma.sale.findMany({
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, nameMm: true, sku: true },
          },
        },
      },
      customer: {
        select: { id: true, name: true, phone: true },
      },
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  const serializedSales = sales.map((sale) => ({
    ...sale,
    subtotal: toNumber(sale.subtotal),
    discountAmount: toNumber(sale.discountAmount),
    taxAmount: toNumber(sale.taxAmount),
    totalAmount: toNumber(sale.totalAmount),
    paidAmount: toNumber(sale.paidAmount),
    changeAmount: toNumber(sale.changeAmount),
    items: sale.items.map((item) => ({
      ...item,
      unitPrice: toNumber(item.unitPrice),
      discount: toNumber(item.discount),
      total: toNumber(item.total),
    })),
  }));

  return <SalesClient initialSales={serializedSales} />;
}
