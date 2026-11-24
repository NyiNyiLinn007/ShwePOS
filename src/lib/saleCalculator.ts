/**
 * Shared MMK (Myanmar Kyat) integer pricing calculator (0 decimals, Math.round).
 * Used identically by POS Cart, PaymentModal, Quotations, and SaleService
 * so client previews and server-side checkout totals match to the exact Kyat.
 */

export function roundMmk(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  return rounded === 0 ? 0 : rounded;
}

export interface LineAmountResult {
  gross: number;
  discount: number;
  total: number;
}

export function calculateLineAmounts(
  unitPrice: number,
  quantity: number,
  rawItemDiscount = 0
): LineAmountResult {
  const cleanPrice = Math.max(0, roundMmk(unitPrice));
  const gross = Math.max(0, roundMmk(cleanPrice * quantity));
  const discount = Math.max(0, Math.min(gross, roundMmk(rawItemDiscount || 0)));
  const total = Math.max(0, gross - discount);
  return { gross, discount, total };
}

export interface OrderTotalInput {
  subtotal: number;
  itemDiscountTotal: number;
  cartDiscount: number;
  promotionDiscount: number;
  loyaltyDiscount: number;
  taxRate: number;
}

export interface OrderTotalResult {
  subtotal: number;
  itemDiscountTotal: number;
  cartDiscountAmount: number;
  promotionDiscountAmount: number;
  loyaltyDiscountAmount: number;
  effectiveDiscount: number;
  discountedSubtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export function calculateOrderTotals(input: OrderTotalInput): OrderTotalResult {
  const subtotal = Math.max(0, roundMmk(input.subtotal));
  const itemDiscountTotal = Math.max(0, Math.min(subtotal, roundMmk(input.itemDiscountTotal)));
  const afterItem = Math.max(0, subtotal - itemDiscountTotal);

  const cartDiscountAmount = Math.max(0, Math.min(afterItem, roundMmk(input.cartDiscount)));
  const afterCart = Math.max(0, afterItem - cartDiscountAmount);

  const promotionDiscountAmount = Math.max(
    0,
    Math.min(afterCart, roundMmk(input.promotionDiscount))
  );
  const afterPromo = Math.max(0, afterCart - promotionDiscountAmount);

  const loyaltyDiscountAmount = Math.max(
    0,
    Math.min(afterPromo, roundMmk(input.loyaltyDiscount))
  );
  const effectiveDiscount =
    itemDiscountTotal + cartDiscountAmount + promotionDiscountAmount + loyaltyDiscountAmount;

  const discountedSubtotal = Math.max(0, subtotal - effectiveDiscount);
  const taxRate = Number.isFinite(input.taxRate) && input.taxRate > 0 ? input.taxRate : 0;
  const taxAmount = roundMmk(discountedSubtotal * (taxRate / 100));
  const totalAmount = discountedSubtotal + taxAmount;

  return {
    subtotal,
    itemDiscountTotal,
    cartDiscountAmount,
    promotionDiscountAmount,
    loyaltyDiscountAmount,
    effectiveDiscount,
    discountedSubtotal,
    taxAmount,
    totalAmount,
  };
}
