import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApiError, requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { createExpenseSchema } from '@/lib/validations';
import { roundMoney, serializePrismaData, toNumber } from '@/lib/number';
import { parseMyanmarDateBoundary } from '@/lib/utils';
import { summarizeShiftCash } from '@/lib/shiftUtils';
import { logAudit } from '@/services/auditService';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: Record<string, unknown> = {};

    if (category) {
      where.category = category;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) {
        const start = parseMyanmarDateBoundary(startDate, false);
        if (!start) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
        (where.date as Record<string, unknown>).gte = start;
      }
      if (endDate) {
        const end = parseMyanmarDateBoundary(endDate, true);
        if (!end) return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 });
        (where.date as Record<string, unknown>).lte = end;
      }
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    // Calculate category totals
    const categoryTotals: Record<string, number> = {};
    let totalAmount = 0;
    for (const expense of expenses) {
      categoryTotals[expense.category] =
        (categoryTotals[expense.category] || 0) + toNumber(expense.amount);
      totalAmount += toNumber(expense.amount);
    }

    return NextResponse.json({
      expenses: expenses.map((expense) => ({ ...expense, amount: toNumber(expense.amount) })),
      summary: {
        totalAmount: roundMoney(totalAmount),
        categoryTotals: Object.entries(categoryTotals).map(([cat, amount]) => ({
          category: cat,
          amount: roundMoney(amount),
        })),
        count: expenses.length,
      },
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch expenses');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');

    const parsed = createExpenseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { category, amount: rawAmount, description, date, useCashDrawer } = parsed.data;
    const amount = roundMoney(rawAmount);

    const parsedDate = date
      ? (parseMyanmarDateBoundary(date, false) ?? new Date(date))
      : new Date();

    const expense = await prisma.$transaction(async (tx) => {
      let openShiftId: string | null = null;
      if (useCashDrawer) {
        const openShift = await tx.shift.findFirst({
          where: { userId: user.id, status: 'OPEN' },
          include: { cashDrawerMovements: { select: { type: true, amount: true } } },
          orderBy: { openedAt: 'desc' },
        });
        if (!openShift) {
          throw new ApiError(
            'You must have an open shift to pay an expense from the cash drawer',
            409
          );
        }
        const summary = summarizeShiftCash(openShift.openingCash, openShift.cashDrawerMovements);
        if (amount > summary.expectedCash) {
          throw new ApiError(
            `Expense amount (${amount}) exceeds available cash drawer balance (${summary.expectedCash})`,
            400
          );
        }
        openShiftId = openShift.id;
      }

      const created = await tx.expense.create({
        data: {
          category,
          amount,
          description: description || null,
          userId: user.id,
          date: parsedDate,
        },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      });

      if (openShiftId) {
        await tx.cashDrawerMovement.create({
          data: {
            shiftId: openShiftId,
            expenseId: created.id,
            userId: user.id,
            type: 'PAID_OUT',
            amount,
            reason: `Expense (${category})${description ? `: ${description}` : ''}`,
          },
        });
      }

      await logAudit(
        {
          userId: user.id,
          action: 'EXPENSE_CREATED',
          entityType: 'EXPENSE',
          entityId: created.id,
          summary: `Recorded ${category} expense of ${amount} K${openShiftId ? ' (paid from cash drawer)' : ''}`,
          metadata: {
            category,
            amount,
            description: description || null,
            useCashDrawer: Boolean(openShiftId),
            shiftId: openShiftId,
          },
        },
        tx
      );

      return created;
    });

    return NextResponse.json(serializePrismaData(expense), { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create expense');
  }
}
