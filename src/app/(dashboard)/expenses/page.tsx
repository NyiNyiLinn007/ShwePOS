import prisma from '@/lib/prisma';
import { ExpensesClient } from '@/components/expenses/ExpensesClient';
import { requirePageRole } from '@/lib/pageAuth';
import { roundMoney, toNumber } from '@/lib/number';

export default async function ExpensesPage() {
  await requirePageRole('MANAGER', 'ADMIN');

  const expenses = await prisma.expense.findMany({
    include: {
      user: { select: { id: true, name: true } },
    },
    orderBy: { date: 'desc' },
  });

  // Calculate category totals
  const categoryTotals: Record<string, number> = {};
  let totalAmount = 0;
  const serializedExpenses = expenses.map((expense) => {
    const amount = toNumber(expense.amount);
    categoryTotals[expense.category] = (categoryTotals[expense.category] || 0) + amount;
    totalAmount += amount;
    return {
      ...expense,
      amount,
    };
  });

  return (
    <ExpensesClient
      initialExpenses={serializedExpenses}
      initialSummary={{
        totalAmount: roundMoney(totalAmount),
        categoryTotals: Object.entries(categoryTotals).map(([category, amount]) => ({
          category,
          amount: roundMoney(amount),
        })),
        count: expenses.length,
      }}
    />
  );
}
