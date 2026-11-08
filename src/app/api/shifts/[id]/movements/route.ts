import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApiError, handleApiError, requireAuth, validateCsrf } from '@/lib/apiAuth';
import { shiftCashMovementSchema } from '@/lib/validations';
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

    const parsed = shiftCashMovementSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { type, amount: rawAmount, reason } = parsed.data;
    const amount = roundMoney(rawAmount);

    const updatedShift = await prisma.$transaction(async (tx) => {
      const shift = await tx.shift.findUnique({
        where: { id },
        include: {
          cashDrawerMovements: {
            select: { type: true, amount: true },
          },
        },
      });

      if (!shift) {
        throw new ApiError('Shift not found', 404);
      }
      if (shift.status !== 'OPEN') {
        throw new ApiError('Cannot record cash movements on a closed shift', 409);
      }
      if (shift.userId !== user.id && user.role === 'CASHIER') {
        throw new ApiError('You can only record cash movements on your own shift', 403);
      }

      const summary = summarizeShiftCash(shift.openingCash, shift.cashDrawerMovements);
      if (type === 'PAID_OUT' && amount > summary.expectedCash) {
        throw new ApiError(
          `Paid-out amount (${amount}) exceeds available drawer cash (${summary.expectedCash})`,
          400
        );
      }

      await tx.cashDrawerMovement.create({
        data: {
          shiftId: shift.id,
          userId: user.id,
          type,
          amount,
          reason: reason.trim(),
        },
      });

      return tx.shift.findUniqueOrThrow({
        where: { id: shift.id },
        include: {
          user: { select: { id: true, name: true, email: true } },
          cashDrawerMovements: {
            select: { id: true, type: true, amount: true, reason: true, createdAt: true },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    const movements = updatedShift.cashDrawerMovements.map((m) => ({
      ...m,
      amount: toNumber(m.amount),
      createdAt: m.createdAt.toISOString(),
    }));
    const summary = summarizeShiftCash(updatedShift.openingCash, movements);

    return NextResponse.json(
      {
        shift: {
          id: updatedShift.id,
          userId: updatedShift.userId,
          user: updatedShift.user,
          openingCash: toNumber(updatedShift.openingCash),
          closingCash: updatedShift.closingCash === null ? null : toNumber(updatedShift.closingCash),
          expectedCash: summary.expectedCash,
          actualCash: updatedShift.actualCash === null ? null : toNumber(updatedShift.actualCash),
          variance: updatedShift.variance === null ? null : toNumber(updatedShift.variance),
          status: updatedShift.status,
          openedAt: updatedShift.openedAt.toISOString(),
          closedAt: updatedShift.closedAt?.toISOString() ?? null,
          notes: updatedShift.notes,
          summary,
          movements,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, 'Failed to record cash drawer movement');
  }
}
