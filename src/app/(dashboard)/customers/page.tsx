import prisma from '@/lib/prisma';
import { CustomersClient } from '@/components/customers/CustomersClient';
import { requirePageRole } from '@/lib/pageAuth';
import { toNumber } from '@/lib/number';

export const dynamic = 'force-dynamic';

export default async function CustomersPage() {
  const session = await requirePageRole('MANAGER', 'ADMIN');

  const saleSelect = {
    id: true,
    customerId: true,
    totalAmount: true,
    paidAmount: true,
    dueAmount: true,
    paymentMethod: true,
    createdAt: true,
    status: true,
    invoiceNumber: true,
  } as const;

  // Bounded parallel queries: latest 20 sales per customer + uncapped purchase counts + all unpaid invoices
  const [customers, purchaseCounts, unpaidSalesList] = await Promise.all([
    prisma.customer.findMany({
      include: {
        sales: {
          select: saleSelect,
          orderBy: { createdAt: 'desc' },
          take: 20,
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
    }),
    prisma.sale.groupBy({
      by: ['customerId'],
      where: {
        customerId: { not: null },
        status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
      },
      _count: { id: true },
    }),
    prisma.sale.findMany({
      where: {
        customerId: { not: null },
        status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
        dueAmount: { gt: 0 },
      },
      select: saleSelect,
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const countByCustomer = new Map<string, number>();
  for (const row of purchaseCounts) {
    if (row.customerId) {
      countByCustomer.set(row.customerId, row._count.id);
    }
  }

  const unpaidByCustomer = new Map<string, typeof unpaidSalesList>();
  for (const sale of unpaidSalesList) {
    if (!sale.customerId) continue;
    const list = unpaidByCustomer.get(sale.customerId) ?? [];
    list.push(sale);
    unpaidByCustomer.set(sale.customerId, list);
  }

  const customersWithStats = customers.map((customer) => {
    const lastSale = customer.sales[0] || null;
    const unpaidSales = unpaidByCustomer.get(customer.id) ?? [];

    // Merge latest 20 sales + ALL unpaid credit sales so Credit Statements never truncate debt
    const mergedMap = new Map<string, (typeof customer.sales)[number]>();
    for (const s of customer.sales) mergedMap.set(s.id, s);
    for (const s of unpaidSales) mergedMap.set(s.id, s);
    const mergedSales = Array.from(mergedMap.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );

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
      purchaseCount: countByCustomer.get(customer.id) ?? 0,
      lastPurchaseDate: lastSale?.createdAt ? lastSale.createdAt.toISOString() : null,
      recentSales: mergedSales.map((s) => ({
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

  return <CustomersClient initialCustomers={customersWithStats} userRole={session.user.role} />;
}
