import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApiError, handleApiError, requireRole, validateCsrf } from '@/lib/apiAuth';
import { repayCustomerDebtSchema } from '@/lib/validations';
import { roundMoney, serializePrismaData, toNumber } from '@/lib/number';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');
    const { id } = await params;

    const parsed = repayCustomerDebtSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { amount: rawAmount, method, reference, notes } = parsed.data;
    const amount = roundMoney(rawAmount);
    const cleanRef = reference?.trim() || null;

    if (method !== 'CASH' && !cleanRef) {
      return NextResponse.json(
        { error: 'Payment reference is required for non-cash repayments' },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id },
        select: { id: true, name: true, creditBalance: true },
      });

      if (!customer) {
        throw new ApiError('Customer not found', 404);
      }

      const currentDebt = roundMoney(toNumber(customer.creditBalance));
      if (currentDebt <= 0) {
        throw new ApiError('Customer has no outstanding credit balance', 400);
      }
      if (amount > currentDebt) {
        throw new ApiError(
          `Repayment amount (${amount}) cannot exceed outstanding balance (${currentDebt})`,
          400
        );
      }

      let activeShiftId: string | null = null;
      if (method === 'CASH') {
        const openShift =
          (await tx.shift.findFirst({
            where: { userId: user.id, status: 'OPEN' },
            select: { id: true },
            orderBy: { openedAt: 'desc' },
          })) ??
          (await tx.shift.findFirst({
            where: { status: 'OPEN' },
            select: { id: true },
            orderBy: { openedAt: 'desc' },
          }));

        if (openShift) {
          activeShiftId = openShift.id;
          await tx.cashDrawerMovement.create({
            data: {
              shiftId: openShift.id,
              userId: user.id,
              type: 'PAID_IN',
              amount,
              reason: `Credit repayment from ${customer.name}${notes ? `: ${notes}` : ''}`,
            },
          });
        }
      }

      const payment = await tx.salePayment.create({
        data: {
          customerId: customer.id,
          userId: user.id,
          shiftId: activeShiftId,
          method,
          amount,
          reference: cleanRef,
          type: 'DEBT_REPAYMENT',
          notes: notes?.trim() || null,
        },
      });

      const updatedCustomer = await tx.customer.update({
        where: { id: customer.id },
        data: {
          creditBalance: { decrement: amount },
        },
      });

      return { customer: updatedCustomer, payment };
    });

    return NextResponse.json(serializePrismaData(result), { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to record debt repayment');
  }
}
