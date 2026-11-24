import { roundMmk } from '@/lib/saleCalculator';
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

export type PromoCodeFailureReason =
  | 'NOT_FOUND'
  | 'MIN_SPEND_NOT_MET'
  | 'NO_ELIGIBLE_ITEMS'
  | 'OUTPERFORMED'
  | null;

export interface PromotionEvaluationOutput {
  best: AppliedPromotionResult | null;
  codeMatched: boolean;
  matchedPromo: EvaluablePromotion | null;
  matchedPromoDiscount: number;
  codeFailureReason: PromoCodeFailureReason;
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
  promo: EvaluablePromotion,
  cartDiscountAmount = 0
): number {
  if (lines.length === 0) return 0;

  const totalCartNet = roundMmk(
    lines.reduce((sum, l) => sum + Math.max(0, l.lineTotal), 0)
  );
  if (totalCartNet <= 0) return 0;

  // Evaluate order-level minimum spend against post-cart-discount subtotal
  const postCartDiscountSpend = Math.max(
    0,
    roundMmk(totalCartNet - Math.max(0, roundMmk(cartDiscountAmount)))
  );

  const eligibleLines = getEligibleLines(lines, promo);
  const eligibleSubtotal = roundMmk(
    eligibleLines.reduce((sum, l) => sum + Math.max(0, l.lineTotal), 0)
  );

  switch (promo.type) {
    case 'PERCENT_OFF': {
      if (eligibleSubtotal <= 0 || promo.discountValue <= 0) return 0;
      const pct = Math.min(100, Math.max(0, promo.discountValue));
      return roundMmk(Math.min(eligibleSubtotal, (eligibleSubtotal * pct) / 100));
    }
    case 'FIXED_OFF': {
      if (eligibleSubtotal <= 0 || promo.discountValue <= 0) return 0;
      return roundMmk(Math.min(eligibleSubtotal, promo.discountValue));
    }
    case 'BUY_X_GET_Y': {
      const buyQty = promo.buyQty ?? 0;
      const getQty = promo.getQty ?? 0;
      if (buyQty <= 0 || getQty <= 0 || eligibleLines.length === 0) return 0;
      const bundleSize = buyQty + getQty;
      // Aggregate integer quantities across eligible lines for mix-and-match category/store promos
      const totalEligibleQty = eligibleLines.reduce(
        (sum, l) => sum + Math.max(0, Math.floor(l.quantity)),
        0
      );
      const bundles = Math.floor(totalEligibleQty / bundleSize);
      if (bundles <= 0) return 0;
      let remainingFree = bundles * getQty;
      // Discount cheapest eligible unit prices first (standard retail practice)
      const sortedByPrice = [...eligibleLines]
        .filter((l) => Math.floor(l.quantity) > 0 && l.unitPrice > 0)
        .sort((a, b) => a.unitPrice - b.unitPrice);
      let totalFreeDiscount = 0;
      for (const line of sortedByPrice) {
        if (remainingFree <= 0) break;
        const takeFree = Math.min(remainingFree, Math.floor(line.quantity));
        const lineDiscount = roundMmk(Math.min(line.lineTotal, takeFree * line.unitPrice));
        totalFreeDiscount += lineDiscount;
        remainingFree -= takeFree;
      }
      return roundMmk(Math.min(totalCartNet, totalFreeDiscount));
    }
    case 'MIN_SPEND_PERCENT': {
      const threshold = promo.minSpend ?? 0;
      if (postCartDiscountSpend < threshold || promo.discountValue <= 0) return 0;
      const pct = Math.min(100, Math.max(0, promo.discountValue));
      return roundMmk(Math.min(postCartDiscountSpend, (postCartDiscountSpend * pct) / 100));
    }
    case 'MIN_SPEND_FIXED': {
      const threshold = promo.minSpend ?? 0;
      if (postCartDiscountSpend < threshold || promo.discountValue <= 0) return 0;
      return roundMmk(Math.min(postCartDiscountSpend, promo.discountValue));
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
  now: Date = new Date(),
  cartDiscountAmount = 0
): PromotionEvaluationOutput {
  const normalizedCode = promoCode?.trim().toUpperCase() || '';
  let codeMatched = false;
  let matchedPromo: EvaluablePromotion | null = null;
  let matchedPromoDiscount = 0;
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
    const isCodePromo = Boolean(pCode);
    if (isCodePromo) {
      if (!normalizedCode || normalizedCode !== pCode) continue;
      codeMatched = true;
      matchedPromo = promo;
    }

    const discountAmount = calculateSinglePromotionDiscount(lines, promo, cartDiscountAmount);
    if (isCodePromo) {
      matchedPromoDiscount = discountAmount;
    }
    if (discountAmount > 0) {
      if (!best || discountAmount > best.discountAmount) {
        best = { promotion: promo, discountAmount };
      }
    }
  }

  let codeFailureReason: PromoCodeFailureReason = null;
  if (normalizedCode) {
    if (!codeMatched || !matchedPromo) {
      codeFailureReason = 'NOT_FOUND';
    } else if (matchedPromoDiscount <= 0) {
      codeFailureReason =
        matchedPromo.type === 'MIN_SPEND_PERCENT' || matchedPromo.type === 'MIN_SPEND_FIXED'
          ? 'MIN_SPEND_NOT_MET'
          : 'NO_ELIGIBLE_ITEMS';
    } else if (best && best.promotion.id !== matchedPromo.id) {
      codeFailureReason = 'OUTPERFORMED';
    }
  }

  return {
    best,
    codeMatched,
    matchedPromo,
    matchedPromoDiscount,
    codeFailureReason,
  };
}
