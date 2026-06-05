import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
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
    console.error('Failed to fetch expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expenses' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category, amount, description, userId, date } = body;

    if (!category || !amount || !userId) {
      return NextResponse.json(
        { error: 'Category, amount, and user ID are required' },
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

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const expense = await prisma.expense.create({
      data: {
        category,
        amount,
        description: description || null,
        userId,
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
    console.error('Failed to create expense:', error);
    return NextResponse.json(
      { error: 'Failed to create expense' },
      { status: 500 }
    );
  }
}
