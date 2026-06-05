import prisma from '@/lib/prisma';
import { ExpensesClient } from '@/components/expenses/ExpensesClient';

export default async function ExpensesPage() {
  const [expenses, users] = await Promise.all([
    prisma.expense.findMany({
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  // Calculate category totals
  const categoryTotals: Record<string, number> = {};
  let totalAmount = 0;
  for (const expense of expenses) {
    categoryTotals[expense.category] =
      (categoryTotals[expense.category] || 0) + expense.amount;
    totalAmount += expense.amount;
  }

  return (
    <ExpensesClient
      initialExpenses={expenses}
      users={users}
      initialSummary={{
        totalAmount: Math.round(totalAmount),
        categoryTotals: Object.entries(categoryTotals).map(([category, amount]) => ({
          category,
          amount: Math.round(amount),
        })),
        count: expenses.length,
      }}
    />
  );
}
