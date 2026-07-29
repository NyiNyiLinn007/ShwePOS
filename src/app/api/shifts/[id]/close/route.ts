import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApiError, handleApiError, requireAuth, validateCsrf } from '@/lib/apiAuth';
import { closeShiftSchema } from '@/lib/validations';
import { roundMoney, toNumber } from '@/lib/number';
import { summarizeShiftCash } from '@/lib/shiftUtils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const { id } = await params;
    const parsed = closeShiftSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const shift = await prisma.shift.findUnique({ where: { id }, select: { id: true, userId: true, status: true } });
    if (!shift) throw new ApiError('Shift not found', 404);
    if (shift.status !== 'OPEN') throw new ApiError('This shift is already closed', 409);
    if (shift.userId !== user.id && user.role === 'CASHIER') {
      throw new ApiError('You can only close your own shift', 403);
    }

    const closed = await prisma.$transaction(async (tx) => {
      const current = await tx.shift.findUnique({
        where: { id },
        include: { cashDrawerMovements: { select: { type: true, amount: true } } },
      });
      if (!current || current.status !== 'OPEN') {
        throw new ApiError('This shift was already closed', 409);
      }

      const summary = summarizeShiftCash(current.openingCash, current.cashDrawerMovements);
      const actualCash = parsed.data.actualCash;
      const variance = roundMoney(actualCash - summary.expectedCash);

      await tx.cashDrawerMovement.create({
        data: {
          shiftId: id,
          userId: user.id,
          type: 'CLOSING',
          amount: actualCash,
          reason: 'Cashier shift closed',
        },
      });

      return tx.shift.update({
        where: { id },
        data: {
          status: 'CLOSED',
          closingCash: actualCash,
          expectedCash: summary.expectedCash,
          actualCash,
          variance,
          closedAt: new Date(),
          notes: parsed.data.notes?.trim() || current.notes,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
          cashDrawerMovements: {
            select: { id: true, type: true, amount: true, reason: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    return NextResponse.json({ shift: serializeClosedShift(closed) });
  } catch (error) {
    return handleApiError(error, 'Failed to close shift');
  }
}

function serializeClosedShift(shift: {
  id: string;
  userId: string;
  openingCash: unknown;
  closingCash: unknown;
  expectedCash: unknown;
  actualCash: unknown;
  variance: unknown;
  status: string;
  openedAt: Date;
  closedAt: Date | null;
  notes: string | null;
  user: { id: string; name: string; email: string };
  cashDrawerMovements: Array<{ id: string; type: string; amount: unknown; reason: string | null; createdAt: Date }>;
}) {
  const movements = shift.cashDrawerMovements.map((movement) => ({
    ...movement,
    amount: toNumber(movement.amount),
    createdAt: movement.createdAt.toISOString(),
  }));
  return {
    ...shift,
    openingCash: toNumber(shift.openingCash),
    closingCash: shift.closingCash === null ? null : toNumber(shift.closingCash),
    expectedCash: toNumber(shift.expectedCash),
    actualCash: shift.actualCash === null ? null : toNumber(shift.actualCash),
    variance: shift.variance === null ? null : toNumber(shift.variance),
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt?.toISOString() ?? null,
    cashDrawerMovements: movements,
  };
}
