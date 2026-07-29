import { notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import { requirePageAuth } from '@/lib/pageAuth';
import { SaleDetailClient } from '@/components/sales/SaleDetailClient';
import SaleDetailHeader from '@/components/sales/SaleDetailHeader';
import { serializePrismaData } from '@/lib/number';

interface SaleDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function SaleDetailPage({ params }: SaleDetailPageProps) {
  const session = await requirePageAuth();
  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              nameMm: true,
              sku: true,
              barcode: true,
            },
          },
        },
      },
      customer: {
        select: { id: true, name: true, phone: true, email: true },
      },
      user: {
        select: { id: true, name: true },
      },
    },
  });

  if (!sale) {
    notFound();
  }

  if (session.user.role === 'CASHIER' && sale.userId !== session.user.id) {
    notFound();
  }

  return (
    <>
      <SaleDetailHeader invoiceNumber={sale.invoiceNumber} />

      <SaleDetailClient sale={serializePrismaData(sale)} />
    </>
  );
}
