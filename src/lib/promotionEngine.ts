import { roundMoney } from '@/lib/number';
import type { PromotionType } from '@/types';

export interface PromoCartLine {
  productId: string;
  categoryId?: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number; // after line item discount
}

export interface EvaluablePromotion {
  id: string;
  name: string;
  nameMm?: string | null;
  code: string | null;
  type: PromotionType;
  discountValue: number;
  minSpend?: number | null;
  buyQty?: number | null;
  getQty?: number | null;
  categoryId?: string | null;
  productId?: string | null;
  startDate: string | Date;
  endDate: string | Date;
  usageLimit?: number | null;
  usedCount?: number;
  isActive: boolean;
}

export interface AppliedPromotionResult {
  promotion: EvaluablePromotion;
  discountAmount: number;
}

export interface PromotionEvaluationOutput {
  best: AppliedPromotionResult | null;
  codeMatched: boolean;
}

function getEligibleLines(
  lines: PromoCartLine[],
  promo: EvaluablePromotion
): PromoCartLine[] {
  if (promo.productId) {
    return lines.filter((l) => l.productId === promo.productId);
  }
  if (promo.categoryId) {
    return lines.filter((l) => l.categoryId === promo.categoryId);
  }
  return lines;
}

export function calculateSinglePromotionDiscount(
  lines: PromoCartLine[],
  promo: EvaluablePromotion
): number {
  if (lines.length === 0) return 0;

  const totalCartNet = roundMoney(
    lines.reduce((sum, l) => sum + Math.max(0, l.lineTotal), 0)
  );
  if (totalCartNet <= 0) return 0;

  const eligibleLines = getEligibleLines(lines, promo);
  const eligibleSubtotal = roundMoney(
    eligibleLines.reduce((sum, l) => sum + Math.max(0, l.lineTotal), 0)
  );

  switch (promo.type) {
    case 'PERCENT_OFF': {
      if (eligibleSubtotal <= 0 || promo.discountValue <= 0) return 0;
      const pct = Math.min(100, Math.max(0, promo.discountValue));
      return roundMoney(Math.min(eligibleSubtotal, (eligibleSubtotal * pct) / 100));
    }
    case 'FIXED_OFF': {
      if (eligibleSubtotal <= 0 || promo.discountValue <= 0) return 0;
      return roundMoney(Math.min(eligibleSubtotal, promo.discountValue));
    }
    case 'BUY_X_GET_Y': {
      const buyQty = promo.buyQty ?? 0;
      const getQty = promo.getQty ?? 0;
      if (buyQty <= 0 || getQty <= 0 || eligibleLines.length === 0) return 0;
      const bundleSize = buyQty + getQty;
      let totalFreeDiscount = 0;
      for (const line of eligibleLines) {
        const bundles = Math.floor(line.quantity / bundleSize);
        if (bundles > 0) {
          const freeUnits = bundles * getQty;
          const lineDiscount = roundMoney(Math.min(line.lineTotal, freeUnits * line.unitPrice));
          totalFreeDiscount = roundMoney(totalFreeDiscount + lineDiscount);
        }
      }
      return roundMoney(Math.min(totalCartNet, totalFreeDiscount));
    }
    case 'MIN_SPEND_PERCENT': {
      const threshold = promo.minSpend ?? 0;
      if (totalCartNet < threshold || promo.discountValue <= 0) return 0;
      const pct = Math.min(100, Math.max(0, promo.discountValue));
      return roundMoney(Math.min(totalCartNet, (totalCartNet * pct) / 100));
    }
    case 'MIN_SPEND_FIXED': {
      const threshold = promo.minSpend ?? 0;
      if (totalCartNet < threshold || promo.discountValue <= 0) return 0;
      return roundMoney(Math.min(totalCartNet, promo.discountValue));
    }
    default:
      return 0;
  }
}

/**
 * Evaluates all active promotions against the cart and selects the
 * Best Single Discount (non-stacking) to protect store margins.
 */
export function evaluateBestPromotion(
  lines: PromoCartLine[],
  promotions: EvaluablePromotion[],
  promoCode?: string | null,
  now: Date = new Date()
): PromotionEvaluationOutput {
  const normalizedCode = promoCode?.trim().toUpperCase() || '';
  let codeMatched = false;
  let best: AppliedPromotionResult | null = null;

  for (const promo of promotions) {
    if (!promo.isActive) continue;

    const start = new Date(promo.startDate);
    const end = new Date(promo.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (now < start || now > end) continue;

    if (
      promo.usageLimit !== null &&
      promo.usageLimit !== undefined &&
      (promo.usedCount ?? 0) >= promo.usageLimit
    ) {
      continue;
    }

    const pCode = promo.code?.trim().toUpperCase() || '';
    if (pCode) {
      if (!normalizedCode || normalizedCode !== pCode) continue;
      codeMatched = true;
    }

    const discountAmount = calculateSinglePromotionDiscount(lines, promo);
    if (discountAmount > 0) {
      if (!best || discountAmount > best.discountAmount) {
        best = { promotion: promo, discountAmount };
      }
    }
  }

  return { best, codeMatched };
}
