import prisma from '@/lib/prisma';
import { CustomersClient } from '@/components/customers/CustomersClient';

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    include: {
      sales: {
        select: {
          id: true,
          totalAmount: true,
          createdAt: true,
          status: true,
          invoiceNumber: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const customersWithStats = customers.map((customer) => {
    const completedSales = customer.sales.filter(
      (s) => s.status === 'COMPLETED'
    );
    const lastSale = customer.sales[0] || null;

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      totalPurchases: customer.totalPurchases,
      loyaltyPoints: customer.loyaltyPoints,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      purchaseCount: completedSales.length,
      lastPurchaseDate: lastSale?.createdAt || null,
      recentSales: customer.sales.slice(0, 20).map((s) => ({
        id: s.id,
        invoiceNumber: s.invoiceNumber,
        totalAmount: s.totalAmount,
        status: s.status,
        createdAt: s.createdAt,
      })),
    };
  });

  return <CustomersClient initialCustomers={customersWithStats} />;
}
