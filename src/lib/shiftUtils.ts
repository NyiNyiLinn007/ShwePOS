import { roundMoney, toNumber } from '@/lib/number';

export interface ShiftMovementLike {
  type: string;
  amount: unknown;
}

export interface ShiftCashSummary {
  cashSales: number;
  refunds: number;
  paidIn: number;
  paidOut: number;
  expectedCash: number;
  movementCount: number;
}

/** Calculate the cash drawer balance without counting opening/closing snapshots twice. */
export function summarizeShiftCash(
  openingCash: unknown,
  movements: ShiftMovementLike[]
): ShiftCashSummary {
  let cashSales = 0;
  let refunds = 0;
  let paidIn = 0;
  let paidOut = 0;
  let movementCount = 0;

  for (const movement of movements) {
    const amount = Math.abs(toNumber(movement.amount));
    switch (movement.type) {
      case 'CASH_SALE':
        cashSales += amount;
        movementCount += 1;
        break;
      case 'REFUND':
      case 'VOID':
        refunds += amount;
        movementCount += 1;
        break;
      case 'PAID_IN':
        paidIn += amount;
        movementCount += 1;
        break;
      case 'PAID_OUT':
        paidOut += amount;
        movementCount += 1;
        break;
      default:
        break;
    }
  }

  return {
    cashSales: roundMoney(cashSales),
    refunds: roundMoney(refunds),
    paidIn: roundMoney(paidIn),
    paidOut: roundMoney(paidOut),
    expectedCash: roundMoney(toNumber(openingCash) + cashSales - refunds + paidIn - paidOut),
    movementCount,
  };
}
