import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ApiError, handleApiError, requireRole, validateCsrf } from '@/lib/apiAuth';
import { repayCustomerDebtSchema } from '@/lib/validations';
import { roundMoney, serializePrismaData, toNumber } from '@/lib/number';
import { logAudit } from '@/services/auditService';

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

      // Atomically decrement creditBalance with gte guard (prevents concurrent negative balance race)
      const updated = await tx.customer.updateMany({
        where: { id: customer.id, creditBalance: { gte: amount } },
        data: { creditBalance: { decrement: amount } },
      });
      if (updated.count === 0) {
        throw new ApiError(
          `Repayment amount (${amount}) exceeds current outstanding balance`,
          409
        );
      }

      // Only record cash PAID_IN into the acting user's OWN open register (never hijack another cashier's drawer)
      let activeShiftId: string | null = null;
      if (method === 'CASH') {
        const openShift = await tx.shift.findFirst({
          where: { userId: user.id, status: 'OPEN' },
          select: { id: true },
          orderBy: { openedAt: 'desc' },
        });

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

      const updatedCustomer = await tx.customer.findUniqueOrThrow({
        where: { id: customer.id },
      });

      // FIFO settle oldest unpaid credit sales so Sale.dueAmount stays synced with creditBalance
      const unpaidSales = await tx.sale.findMany({
        where: {
          customerId: customer.id,
          status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
          dueAmount: { gt: 0 },
        },
        select: { id: true, dueAmount: true },
        orderBy: { createdAt: 'asc' },
      });

      let remainingToAllocate = amount;
      for (const unpaidSale of unpaidSales) {
        if (remainingToAllocate <= 0) break;
        const saleDue = roundMoney(toNumber(unpaidSale.dueAmount));
        const applied = roundMoney(Math.min(saleDue, remainingToAllocate));
        const nextDue = roundMoney(Math.max(0, saleDue - applied));
        await tx.sale.update({
          where: { id: unpaidSale.id },
          data: {
            dueAmount: nextDue,
            paymentStatus: nextDue <= 0 ? 'PAID' : 'PARTIAL',
          },
        });
        remainingToAllocate = roundMoney(remainingToAllocate - applied);
      }

      const newCreditBalance = roundMoney(toNumber(updatedCustomer.creditBalance));

      await logAudit(
        {
          userId: user.id,
          action: 'CUSTOMER_DEBT_REPAYMENT',
          entityType: 'CUSTOMER',
          entityId: customer.id,
          summary: `Received ${amount} K (${method}) debt repayment from ${customer.name} (Remaining: ${newCreditBalance} K)`,
          metadata: {
            customerName: customer.name,
            previousBalance: currentDebt,
            paidAmount: amount,
            newCreditBalance,
            method,
            reference: cleanRef,
          },
        },
        tx
      );

      return {
        customer: updatedCustomer,
        payment,
        previousBalance: currentDebt,
        paidAmount: amount,
        newCreditBalance,
        receivedBy: user.name,
      };
    });

    return NextResponse.json(serializePrismaData(result), { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to record debt repayment');
  }
}
