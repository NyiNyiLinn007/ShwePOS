import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireRole, validateCsrf } from '@/lib/apiAuth';
import { roundMoney, toNumber } from '@/lib/number';
import { logAudit } from '@/services/auditService';

/**
 * Reconciles Customer.creditBalance & Sale.dueAmount from immutable checkout
 * records (Sale totals minus upfront net payment) and DEBT_REPAYMENT receipts.
 * Idempotent & safe to run repeatedly to repair legacy/drifted balances.
 */
export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireRole('ADMIN', 'MANAGER');

    const result = await prisma.$transaction(
      async (tx) => {
        const customers = await tx.customer.findMany({
          select: {
            id: true,
            name: true,
            creditBalance: true,
            creditLimit: true,
            sales: {
              where: { status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } },
              select: {
                id: true,
                totalAmount: true,
                paidAmount: true,
                changeAmount: true,
                dueAmount: true,
                paymentMethod: true,
                paymentStatus: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'asc' },
            },
            salePayments: {
              where: { type: 'DEBT_REPAYMENT' },
              select: { amount: true },
            },
          },
        });

        let updatedCustomers = 0;
        let updatedSales = 0;
        let totalOutstandingCredit = 0;

        for (const customer of customers) {
          const totalRepaid = roundMoney(
            customer.salePayments.reduce((sum, p) => sum + toNumber(p.amount), 0)
          );

          // Compute original credit incurred per active sale
          const saleCredits = customer.sales.map((sale) => {
            const total = roundMoney(toNumber(sale.totalAmount));
            const paid = roundMoney(toNumber(sale.paidAmount));
            const change = roundMoney(toNumber(sale.changeAmount));
            const netPaidAtCheckout = roundMoney(Math.max(0, paid - change));
            const origCredit = roundMoney(Math.max(0, total - netPaidAtCheckout));
            return { sale, origCredit };
          });

          const totalOrigCredit = roundMoney(
            saleCredits.reduce((sum, s) => sum + s.origCredit, 0)
          );
          const trueCreditBalance = roundMoney(Math.max(0, totalOrigCredit - totalRepaid));
          totalOutstandingCredit = roundMoney(totalOutstandingCredit + trueCreditBalance);

          // FIFO apply repayments across oldest credit sales so Sale.dueAmount is accurate for AR Aging
          let remainingRepaid = totalRepaid;
          for (const { sale, origCredit } of saleCredits) {
            let expectedDue = 0;
            if (origCredit > 0) {
              const settled = roundMoney(Math.min(origCredit, remainingRepaid));
              remainingRepaid = roundMoney(remainingRepaid - settled);
              expectedDue = roundMoney(Math.max(0, origCredit - settled));
            }
            const currentDue = roundMoney(toNumber(sale.dueAmount));
            const expectedPaymentStatus =
              expectedDue <= 0
                ? 'PAID'
                : roundMoney(toNumber(sale.paidAmount)) > 0
                  ? 'PARTIAL'
                  : 'PENDING';

            if (
              Math.abs(currentDue - expectedDue) > 0.009 ||
              (origCredit > 0 && sale.paymentStatus !== expectedPaymentStatus)
            ) {
              await tx.sale.update({
                where: { id: sale.id },
                data: {
                  dueAmount: expectedDue,
                  paymentStatus: expectedPaymentStatus,
                },
              });
              updatedSales += 1;
            }
          }

          const currentBalance = roundMoney(toNumber(customer.creditBalance));
          const hasZeroLimitBug =
            customer.creditLimit !== null && toNumber(customer.creditLimit) === 0;

          if (Math.abs(currentBalance - trueCreditBalance) > 0.009 || hasZeroLimitBug) {
            await tx.customer.update({
              where: { id: customer.id },
              data: {
                creditBalance: trueCreditBalance,
                ...(hasZeroLimitBug && { creditLimit: null }),
              },
            });
            updatedCustomers += 1;
          }
        }

        await logAudit(
          {
            userId: user.id,
            action: 'CUSTOMER_CREDIT_RECONCILED',
            entityType: 'CUSTOMER',
            summary: `Reconciled credit balances across ${customers.length} customer(s): ${updatedCustomers} updated, ${updatedSales} sale(s) synced, total receivable ${totalOutstandingCredit} K`,
            metadata: {
              totalCustomers: customers.length,
              updatedCustomers,
              updatedSales,
              totalOutstandingCredit,
            },
          },
          tx
        );

        return {
          totalCustomers: customers.length,
          updatedCustomers,
          updatedSales,
          totalOutstandingCredit,
        };
      },
      { maxWait: 10_000, timeout: 30_000 }
    );

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, 'Failed to reconcile customer credit balances');
  }
}
