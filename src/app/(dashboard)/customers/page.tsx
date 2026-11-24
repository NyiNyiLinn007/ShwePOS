import prisma from '@/lib/prisma';
import { CustomersClient } from '@/components/customers/CustomersClient';
import { requirePageRole } from '@/lib/pageAuth';
import { toNumber } from '@/lib/number';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  await requirePageRole('MANAGER', 'ADMIN');

  const customers = await prisma.customer.findMany({
    include: {
      sales: {
        select: {
          id: true,
          totalAmount: true,
          paidAmount: true,
          dueAmount: true,
          paymentMethod: true,
          createdAt: true,
          status: true,
          invoiceNumber: true,
        },
        orderBy: { createdAt: 'desc' },
      },
      salePayments: {
        where: { type: 'DEBT_REPAYMENT' },
        select: {
          id: true,
          amount: true,
          method: true,
          reference: true,
          notes: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const customersWithStats = customers.map((customer) => {
    const completedSales = customer.sales.filter(
      (s) => s.status === 'COMPLETED' || s.status === 'PARTIALLY_REFUNDED'
    );
    const lastSale = customer.sales[0] || null;

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      totalPurchases: toNumber(customer.totalPurchases),
      creditBalance: toNumber(customer.creditBalance),
      creditLimit:
        customer.creditLimit !== null && toNumber(customer.creditLimit) > 0
          ? toNumber(customer.creditLimit)
          : null,
      loyaltyPoints: customer.loyaltyPoints,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      purchaseCount: completedSales.length,
      lastPurchaseDate: lastSale?.createdAt ? lastSale.createdAt.toISOString() : null,
      recentSales: customer.sales.slice(0, 20).map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        totalAmount: toNumber(s.totalAmount),
        paidAmount: toNumber(s.paidAmount),
        dueAmount: toNumber(s.dueAmount),
        paymentMethod: s.paymentMethod,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
      })),
      repayments: customer.salePayments.map((p) => ({
        id: p.id,
        amount: toNumber(p.amount),
        method: p.method,
        reference: p.reference,
        notes: p.notes,
        createdAt: p.createdAt.toISOString(),
      })),
    };
  });

  return <CustomersClient initialCustomers={customersWithStats} />;
}
