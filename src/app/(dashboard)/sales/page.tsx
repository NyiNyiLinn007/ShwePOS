import prisma from '@/lib/prisma';
import { SalesClient } from '@/components/sales/SalesClient';
import { requirePageRole } from '@/lib/pageAuth';

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

  return <SalesClient initialSales={sales} />;
}
