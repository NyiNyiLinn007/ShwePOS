import prisma from '@/lib/prisma';
import { ExpensesClient } from '@/components/expenses/ExpensesClient';
import { requirePageRole } from '@/lib/pageAuth';
import { toNumber } from '@/lib/number';

export default async function ExpensesPage() {
  await requirePageRole('MANAGER', 'ADMIN');

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
  const serializedExpenses = expenses.map((expense) => ({
    ...expense,
    amount: toNumber(expense.amount),
  }));
  for (const expense of expenses) {
    categoryTotals[expense.category] =
      (categoryTotals[expense.category] || 0) + toNumber(expense.amount);
    totalAmount += toNumber(expense.amount);
  }

  return (
    <ExpensesClient
      initialExpenses={serializedExpenses}
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
