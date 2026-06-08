import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, handleApiError } from '@/lib/apiAuth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    return NextResponse.json(expense);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch expense');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;
    const body = await request.json();
    const { category, amount, description, date } = body;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return NextResponse.json(
        { error: 'Amount must be a positive number' },
        { status: 400 }
      );
    }

    if (category) {
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
    }

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(category !== undefined && { category }),
        ...(amount !== undefined && { amount }),
        ...(description !== undefined && { description: description || null }),
        ...(date !== undefined && { date: new Date(date) }),
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    return handleApiError(error, 'Failed to update expense');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await prisma.expense.delete({ where: { id } });

    return NextResponse.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    return handleApiError(error, 'Failed to delete expense');
  }
}
