import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, handleApiError } from '@/lib/apiAuth';

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
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        (where.date as Record<string, unknown>).gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
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
        (categoryTotals[expense.category] || 0) + expense.amount;
      totalAmount += expense.amount;
    }

    return NextResponse.json({
      expenses,
      summary: {
        totalAmount: Math.round(totalAmount),
        categoryTotals: Object.entries(categoryTotals).map(([cat, amount]) => ({
          category: cat,
          amount: Math.round(amount),
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
    const user = await requireRole('MANAGER', 'ADMIN');

    const body = await request.json();
    const { category, amount, description, date } = body;

    if (!category || !amount) {
      return NextResponse.json(
        { error: 'Category and amount are required' },
        { status: 400 }
      );
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    const validCategories = [
      'Rent',
      'Utilities',
      'Supplies',
      'Transport',
      'Salary',
      'Marketing',
      'Maintenance',
      'Other',
    ];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { error: 'Invalid expense category' },
        { status: 400 }
      );
    }

    const expense = await prisma.expense.create({
      data: {
        category,
        amount,
        description: description || null,
        userId: user.id,
        date: date ? new Date(date) : new Date(),
      },
      include: {
        user: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create expense');
  }
}
