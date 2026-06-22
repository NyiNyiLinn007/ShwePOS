import { notFound } from 'next/navigation';
import Link from 'next/link';
import prisma from '@/lib/prisma';
import { requirePageAuth } from '@/lib/pageAuth';
import { SaleDetailClient } from '@/components/sales/SaleDetailClient';

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
      <div className="page-header">
        <div className="page-title-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            <Link
              href="/sales"
              className="btn btn-ghost btn-icon"
              style={{ fontSize: 'var(--text-lg)' }}
            >
              ←
            </Link>
            <div>
              <h1 className="page-title">{sale.invoiceNumber}</h1>
              <p className="page-subtitle mm-text">Sale Details / အရောင်းအသေးစိတ်</p>
            </div>
          </div>
        </div>
      </div>

      <SaleDetailClient sale={JSON.parse(JSON.stringify(sale))} />
    </>
  );
}
