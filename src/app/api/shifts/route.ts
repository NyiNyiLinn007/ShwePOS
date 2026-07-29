import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApiError, handleApiError, requireAuth, validateCsrf } from '@/lib/apiAuth';
import { closeShiftSchema, openShiftSchema } from '@/lib/validations';
import { roundMoney, toNumber } from '@/lib/number';
import { summarizeShiftCash } from '@/lib/shiftUtils';

const movementSelect = {
  id: true,
  type: true,
  amount: true,
  reason: true,
  createdAt: true,
} as const;

function serializeShift(shift: {
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
  const summary = summarizeShiftCash(shift.openingCash, movements);

  return {
    id: shift.id,
    userId: shift.userId,
    user: shift.user,
    openingCash: toNumber(shift.openingCash),
    closingCash: shift.closingCash === null ? null : toNumber(shift.closingCash),
    expectedCash: shift.status === 'OPEN' ? summary.expectedCash : toNumber(shift.expectedCash),
    actualCash: shift.actualCash === null ? null : toNumber(shift.actualCash),
    variance: shift.variance === null ? null : toNumber(shift.variance),
    status: shift.status,
    openedAt: shift.openedAt.toISOString(),
    closedAt: shift.closedAt?.toISOString() ?? null,
    notes: shift.notes,
    summary,
    movements,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const currentOnly = searchParams.get('current') === 'true';
    const where = user.role === 'CASHIER' ? { userId: user.id } : {};

    const shifts = await prisma.shift.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        cashDrawerMovements: {
          select: movementSelect,
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: currentOnly ? 10 : 100,
    });

    const serialized = shifts.map(serializeShift);
    const current = serialized.find((shift) => shift.status === 'OPEN' && shift.userId === user.id) ?? null;

    return NextResponse.json(
      { current, shifts: currentOnly ? [] : serialized },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    return handleApiError(error, 'Failed to fetch shifts');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const parsed = openShiftSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await prisma.shift.findFirst({
      where: { userId: user.id, status: 'OPEN' },
      select: { id: true },
    });
    if (existing) {
      throw new ApiError('You already have an open cashier shift', 409);
    }

    const shift = await prisma.$transaction(async (tx) => {
      const created = await tx.shift.create({
        data: {
          userId: user.id,
          openingCash: parsed.data.openingCash,
          status: 'OPEN',
          notes: parsed.data.notes?.trim() || null,
        },
      });

      await tx.cashDrawerMovement.create({
        data: {
          shiftId: created.id,
          userId: user.id,
          type: 'OPENING',
          amount: parsed.data.openingCash,
          reason: 'Cashier shift opened',
        },
      });

      return tx.shift.findUniqueOrThrow({
        where: { id: created.id },
        include: {
          user: { select: { id: true, name: true, email: true } },
          cashDrawerMovements: {
            select: movementSelect,
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });

    return NextResponse.json(serializeShift(shift), { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'You already have an open cashier shift' }, { status: 409 });
    }
    return handleApiError(error, 'Failed to open shift');
  }
}
