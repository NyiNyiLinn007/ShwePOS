import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { handleApiError, requireRole, validateCsrf } from '@/lib/apiAuth';
import { roundMoney, toNumber } from '@/lib/number';
import { logAudit } from '@/services/auditService';

/**
 * Reconciles Customer.creditBalance & Sale.dueAmount by replaying each customer's
 * chronological AR event stream (Credit Sales -> Debt Repayments -> Refund/Void Adjustments).
 * Correctly handles repaid credit sales that were later fully/partially refunded or voided
 * without erasing unrelated legitimate credit sales.
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
              select: {
                id: true,
                subtotal: true,
                discountAmount: true,
                taxAmount: true,
                totalAmount: true,
                paidAmount: true,
                changeAmount: true,
                dueAmount: true,
                paymentMethod: true,
                paymentStatus: true,
                status: true,
                createdAt: true,
                payments: {
                  where: { type: 'CHECKOUT', method: 'CREDIT' },
                  select: { amount: true },
                },
                adjustments: {
                  select: { id: true, amount: true, createdAt: true },
                  orderBy: { createdAt: 'asc' },
                },
              },
              orderBy: { createdAt: 'asc' },
            },
            salePayments: {
              where: { type: 'DEBT_REPAYMENT' },
              select: { id: true, amount: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
            },
          },
        });

        let updatedCustomers = 0;
        let updatedSales = 0;
        let totalOutstandingCredit = 0;

        for (const customer of customers) {
          type ArEvent =
            | { at: number; order: 0; kind: 'SALE'; saleId: string; origCredit: number }
            | { at: number; order: 1; kind: 'REPAY'; amount: number }
            | { at: number; order: 2; kind: 'ADJUST'; saleId: string; amount: number };

          const events: ArEvent[] = [];
          const origCreditBySale = new Map<string, number>();

          for (const sale of customer.sales) {
            // Derive immutable original credit incurred at checkout
            const creditLegsSum = roundMoney(
              sale.payments.reduce((sum, p) => sum + toNumber(p.amount), 0)
            );
            let origCredit = creditLegsSum;
            if (origCredit <= 0) {
              // Legacy fallback for rows without SalePayment legs
              const origTotal = roundMoney(
                Math.max(
                  0,
                  toNumber(sale.subtotal) - toNumber(sale.discountAmount) + toNumber(sale.taxAmount)
                )
              );
              const netPaidAtCheckout = roundMoney(
                Math.max(0, toNumber(sale.paidAmount) - toNumber(sale.changeAmount))
              );
              origCredit = roundMoney(Math.max(0, origTotal - netPaidAtCheckout));
            }
            origCreditBySale.set(sale.id, origCredit);

            if (origCredit > 0) {
              events.push({
                at: sale.createdAt.getTime(),
                order: 0,
                kind: 'SALE',
                saleId: sale.id,
                origCredit,
              });
              for (const adj of sale.adjustments) {
                const adjAmt = roundMoney(toNumber(adj.amount));
                if (adjAmt > 0) {
                  events.push({
                    at: adj.createdAt.getTime(),
                    order: 2,
                    kind: 'ADJUST',
                    saleId: sale.id,
                    amount: adjAmt,
                  });
                }
              }
            }
          }

          for (const rep of customer.salePayments) {
            const amt = roundMoney(toNumber(rep.amount));
            if (amt > 0) {
              events.push({
                at: rep.createdAt.getTime(),
                order: 1,
                kind: 'REPAY',
                amount: amt,
              });
            }
          }

          events.sort((a, b) => a.at - b.at || a.order - b.order);

          const openSaleIds: string[] = [];
          const saleDueMap = new Map<string, number>();
          const saleRepaidMap = new Map<string, number>();

          for (const ev of events) {
            if (ev.kind === 'SALE') {
              openSaleIds.push(ev.saleId);
              saleDueMap.set(ev.saleId, ev.origCredit);
            } else if (ev.kind === 'REPAY') {
              let rem = ev.amount;
              for (const sid of openSaleIds) {
                if (rem <= 0) break;
                const due = saleDueMap.get(sid) ?? 0;
                if (due <= 0) continue;
                const applied = roundMoney(Math.min(due, rem));
                saleDueMap.set(sid, roundMoney(Math.max(0, due - applied)));
                saleRepaidMap.set(sid, roundMoney((saleRepaidMap.get(sid) ?? 0) + applied));
                rem = roundMoney(rem - applied);
              }
            } else if (ev.kind === 'ADJUST') {
              // Adjustment reduces unpaid credit on THAT sale only; any excess was refunded in cash/bank
              const due = saleDueMap.get(ev.saleId) ?? 0;
              if (due > 0) {
                const debtReduction = roundMoney(Math.min(due, ev.amount));
                saleDueMap.set(ev.saleId, roundMoney(Math.max(0, due - debtReduction)));
              }
            }
          }

          let trueCreditBalance = 0;
          for (const sale of customer.sales) {
            const isActive = sale.status === 'COMPLETED' || sale.status === 'PARTIALLY_REFUNDED';
            const expectedDue = isActive ? roundMoney(saleDueMap.get(sale.id) ?? 0) : 0;
            trueCreditBalance = roundMoney(trueCreditBalance + expectedDue);

            if (isActive) {
              const origCredit = origCreditBySale.get(sale.id) ?? 0;
              const repaidOnSale = saleRepaidMap.get(sale.id) ?? 0;
              const netUpfront = roundMoney(
                Math.max(0, toNumber(sale.paidAmount) - toNumber(sale.changeAmount))
              );
              const expectedPaymentStatus =
                expectedDue <= 0
                  ? 'PAID'
                  : netUpfront > 0 || repaidOnSale > 0
                    ? 'PARTIAL'
                    : 'PENDING';

              const currentDue = roundMoney(toNumber(sale.dueAmount));
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
          }

          totalOutstandingCredit = roundMoney(totalOutstandingCredit + trueCreditBalance);

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
