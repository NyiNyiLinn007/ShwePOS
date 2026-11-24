import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { updateExpenseSchema } from '@/lib/validations';
import { roundMoney, serializePrismaData, toNumber } from '@/lib/number';
import { parseMyanmarDateBoundary } from '@/lib/utils';
import { logAudit } from '@/services/auditService';

export async function GET(
  _request: NextRequest,
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

    return NextResponse.json(serializePrismaData(expense));
  } catch (error) {
    return handleApiError(error, 'Failed to fetch expense');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;
    const parsed = updateExpenseSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { category, amount, description, date } = parsed.data;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const cleanAmount = amount !== undefined ? roundMoney(amount) : undefined;

    const expense = await prisma.$transaction(async (tx) => {
      const updated = await tx.expense.update({
        where: { id },
        data: {
          ...(category !== undefined && { category }),
          ...(cleanAmount !== undefined && { amount: cleanAmount }),
          ...(description !== undefined && { description: description || null }),
          ...(date !== undefined && {
            date: parseMyanmarDateBoundary(date, false) ?? new Date(date),
          }),
        },
        include: {
          user: { select: { id: true, name: true } },
        },
      });

      await logAudit(
        {
          userId: user.id,
          action: 'EXPENSE_UPDATED',
          entityType: 'EXPENSE',
          entityId: updated.id,
          summary: `Updated expense ${updated.category} (${toNumber(existing.amount)} K -> ${toNumber(updated.amount)} K)`,
          metadata: {
            previousCategory: existing.category,
            nextCategory: updated.category,
            previousAmount: toNumber(existing.amount),
            nextAmount: toNumber(updated.amount),
          },
        },
        tx
      );

      return updated;
    });

    return NextResponse.json(serializePrismaData(expense));
  } catch (error) {
    return handleApiError(error, 'Failed to update expense');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;

    const existing = await prisma.expense.findUnique({
      where: { id },
      include: {
        cashDrawerMovements: {
          include: { shift: { select: { id: true, status: true } } },
        },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Remove any linked PAID_OUT drawer movements belonging to still-OPEN shifts so drawer stays balanced
      const openMovementIds = existing.cashDrawerMovements
        .filter((m) => m.shift?.status === 'OPEN')
        .map((m) => m.id);
      if (openMovementIds.length > 0) {
        await tx.cashDrawerMovement.deleteMany({
          where: { id: { in: openMovementIds } },
        });
      }

      await tx.expense.delete({ where: { id } });

      await logAudit(
        {
          userId: user.id,
          action: 'EXPENSE_DELETED',
          entityType: 'EXPENSE',
          entityId: existing.id,
          summary: `Deleted ${existing.category} expense of ${toNumber(existing.amount)} K`,
          metadata: {
            category: existing.category,
            amount: toNumber(existing.amount),
            description: existing.description,
            reversedOpenDrawerMovements: openMovementIds.length,
          },
        },
        tx
      );
    });

    return NextResponse.json({ success: true, message: 'Expense deleted' });
  } catch (error) {
    return handleApiError(error, 'Failed to delete expense');
  }
}
