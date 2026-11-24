'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, ProductUnit } from '@/types';
import { isFractionalUnit, roundQuantity } from '@/lib/utils';
import { roundMmk } from '@/lib/saleCalculator';

export type DiscountType = 'PERCENT' | 'FIXED';

export interface ActiveCartCustomer {
  id: string;
  name: string;
  phone: string | null;
  loyaltyPoints?: number;
  creditBalance?: number;
  creditLimit?: number | null;
}

export interface HeldBill {
  id: string;
  label: string;
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  promoCode?: string;
  activeQuotationId?: string | null;
  activeCustomer?: ActiveCartCustomer | null;
  createdAt: string;
}

export function getCartLineKey(item: Pick<CartItem, 'lineKey' | 'productId' | 'productUnitId'>): string {
  return item.lineKey || `${item.productId}:${item.productUnitId ?? 'base'}`;
}

function matchesLine(item: CartItem, keyOrProductId: string): boolean {
  return getCartLineKey(item) === keyOrProductId || item.productId === keyOrProductId;
}

function getMaxQtyForUnit(availableBaseStock: number, unit: string, factor: number): number {
  const safeFactor = factor > 0 ? factor : 1;
  const raw = Math.max(0, availableBaseStock) / safeFactor;
  return isFractionalUnit(unit) ? roundQuantity(raw) : Math.floor(raw + 1e-9);
}

/** Calculate how much base-unit stock is already consumed by OTHER lines of the same product. */
function getOtherLinesBaseUsage(items: CartItem[], productId: string, excludeLineKey: string): number {
  return roundQuantity(
    items.reduce((sum, it) => {
      if (it.productId !== productId || getCartLineKey(it) === excludeLineKey) return sum;
      return sum + it.quantity * (it.unitFactor ?? 1);
    }, 0)
  );
}

interface CartState {
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  promoCode: string;
  activeQuotationId: string | null;
  activeCustomer: ActiveCartCustomer | null;
  heldBills: HeldBill[];

  addItem: (product: Product, qty?: number, unitOverride?: ProductUnit | null) => boolean;
  loadQuotationItems: (
    quotationId: string,
    items: CartItem[],
    discountFixed?: number,
    customer?: ActiveCartCustomer | null
  ) => void;
  setPromoCode: (code: string) => void;
  setActiveCustomer: (customer: ActiveCartCustomer | null) => void;
  removeItem: (keyOrProductId: string) => void;
  updateQuantity: (keyOrProductId: string, qty: number) => void;
  updateUnitPrice: (keyOrProductId: string, newPrice: number) => void;
  setItemUnit: (keyOrProductId: string, productUnitId: string | null) => void;
  updateItemDiscount: (keyOrProductId: string, discountAmount: number) => void;
  clearCart: () => void;
  setDiscount: (amount: number) => void;
  setDiscountType: (type: DiscountType) => void;
  holdCurrentBill: (label?: string) => boolean;
  resumeHeldBill: (id: string) => void;
  removeHeldBill: (id: string) => void;
  getSubtotal: () => number;
  getItemDiscountTotal: () => number;
  getCartDiscountAmount: () => number;
  getTotal: () => number;
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      discount: 0,
      discountType: 'PERCENT',
      promoCode: '',
      activeQuotationId: null,
      activeCustomer: null,
      heldBills: [],

      addItem: (product: Product, qty: number = 1, unitOverride?: ProductUnit | null) => {
        let added = false;
        set((state) => {
          const activeUnitName = unitOverride ? unitOverride.unitName : product.unit;
          const factor = unitOverride ? unitOverride.conversionFactor : 1;
          const activePrice = roundMmk(unitOverride ? unitOverride.sellingPrice : product.sellingPrice);
          const targetUnitId = unitOverride?.id ?? null;
          const lineKey = `${product.id}:${targetUnitId ?? 'base'}`;

          const usedByOtherLines = getOtherLinesBaseUsage(state.items, product.id, lineKey);
          const remainingBaseStock = Math.max(0, roundQuantity(product.stockQuantity - usedByOtherLines));
          const maxForUnit = getMaxQtyForUnit(remainingBaseStock, activeUnitName, factor);
          if (maxForUnit <= 0) return state;

          const stepQty = isFractionalUnit(activeUnitName)
            ? roundQuantity(qty)
            : Math.max(1, Math.round(qty));

          // Always refresh maxStock on existing lines of this product
          const syncedItems = state.items.map((item) =>
            item.productId === product.id
              ? { ...item, maxStock: product.stockQuantity, availableUnits: product.productUnits ?? item.availableUnits }
              : item
          );

          const existingIndex = syncedItems.findIndex(
            (item) => getCartLineKey(item) === lineKey
          );

          if (existingIndex >= 0) {
            const existing = syncedItems[existingIndex];
            const newQty = roundQuantity(Math.min(existing.quantity + stepQty, maxForUnit));
            if (newQty <= existing.quantity) return { items: syncedItems };
            const updatedItems = [...syncedItems];
            updatedItems[existingIndex] = { ...existing, quantity: newQty };
            added = true;
            return { items: updatedItems };
          }

          const clampedQty = roundQuantity(Math.min(stepQty, maxForUnit));
          if (clampedQty <= 0) return state;

          const cartItem: CartItem = {
            lineKey,
            productId: product.id,
            categoryId: product.categoryId,
            name: product.name,
            nameMm: product.nameMm,
            sku: product.sku,
            unitPrice: activePrice,
            originalUnitPrice: activePrice,
            baseSellingPrice: roundMmk(product.sellingPrice),
            costPrice: product.costPrice,
            quantity: clampedQty,
            discount: 0,
            maxStock: product.stockQuantity,
            unit: activeUnitName,
            baseUnit: product.unit,
            productUnitId: targetUnitId,
            unitFactor: factor,
            availableUnits: product.productUnits ?? [],
            imageUrl: product.imageUrl,
          };

          added = true;
          return { items: [...syncedItems, cartItem] };
        });
        return added;
      },

      removeItem: (keyOrProductId: string) => {
        set((state) => ({
          items: state.items.filter((item) => !matchesLine(item, keyOrProductId)),
        }));
      },

      updateQuantity: (keyOrProductId: string, qty: number) => {
        set((state) => {
          const rounded = roundQuantity(qty);
          if (rounded <= 0) {
            return {
              items: state.items.filter((item) => !matchesLine(item, keyOrProductId)),
            };
          }

          return {
            items: state.items.map((item) => {
              if (!matchesLine(item, keyOrProductId)) return item;
              const currentKey = getCartLineKey(item);
              const otherBase = getOtherLinesBaseUsage(state.items, item.productId, currentKey);
              const availBase = Math.max(0, roundQuantity(item.maxStock - otherBase));
              const normalizedQty = isFractionalUnit(item.unit)
                ? rounded
                : Math.max(1, Math.round(rounded));
              const maxForUnit = getMaxQtyForUnit(availBase, item.unit, item.unitFactor ?? 1);
              const clampedQty = roundQuantity(Math.min(normalizedQty, Math.max(0, maxForUnit)));
              const maxLineTotal = roundMmk(item.unitPrice * clampedQty);
              return {
                ...item,
                quantity: clampedQty,
                discount: Math.min(item.discount || 0, maxLineTotal),
              };
            }),
          };
        });
      },

      updateUnitPrice: (keyOrProductId: string, newPrice: number) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (!matchesLine(item, keyOrProductId)) return item;
            const cleanPrice = Math.max(0, roundMmk(newPrice));
            const maxLineTotal = roundMmk(cleanPrice * item.quantity);
            return {
              ...item,
              originalUnitPrice: item.originalUnitPrice ?? item.unitPrice,
              unitPrice: cleanPrice,
              discount: Math.min(item.discount || 0, maxLineTotal),
            };
          }),
        }));
      },

      setItemUnit: (keyOrProductId: string, productUnitId: string | null) => {
        set((state) => {
          const idx = state.items.findIndex((item) => matchesLine(item, keyOrProductId));
          if (idx < 0) return state;

          const item = state.items[idx];
          const units = item.availableUnits ?? [];
          const nextLineKey = `${item.productId}:${productUnitId ?? 'base'}`;
          const currentKey = getCartLineKey(item);
          if (nextLineKey === currentKey) return state;

          let nextUnitName: string;
          let nextFactor: number;
          let nextPrice: number;

          if (!productUnitId) {
            nextUnitName = item.baseUnit ?? item.unit;
            nextFactor = 1;
            nextPrice = roundMmk(
              item.baseSellingPrice ?? item.originalUnitPrice ?? item.unitPrice
            );
          } else {
            const targetUnit = units.find((u) => u.id === productUnitId);
            if (!targetUnit) return state;
            nextUnitName = targetUnit.unitName;
            nextFactor = targetUnit.conversionFactor;
            nextPrice = roundMmk(targetUnit.sellingPrice);
          }

          // Check if another line already exists with nextLineKey — if so, merge quantities
          const duplicateIdx = state.items.findIndex(
            (other, i) => i !== idx && getCartLineKey(other) === nextLineKey
          );

          const usedByUnrelated = roundQuantity(
            state.items.reduce((sum, other, i) => {
              if (i === idx || i === duplicateIdx || other.productId !== item.productId) return sum;
              return sum + other.quantity * (other.unitFactor ?? 1);
            }, 0)
          );
          const availBase = Math.max(0, roundQuantity(item.maxStock - usedByUnrelated));
          const maxForUnit = getMaxQtyForUnit(availBase, nextUnitName, nextFactor);
          if (maxForUnit <= 0) return state;

          const existingDupQty = duplicateIdx >= 0 ? state.items[duplicateIdx].quantity : 0;
          const minQty = isFractionalUnit(nextUnitName) ? Math.min(0.5, maxForUnit) : 1;
          const desiredQty = existingDupQty + item.quantity;
          const clampedQty = roundQuantity(Math.min(maxForUnit, Math.max(minQty, desiredQty)));

          const nextItem: CartItem = {
            ...item,
            lineKey: nextLineKey,
            productUnitId: productUnitId ?? null,
            unit: nextUnitName,
            unitFactor: nextFactor,
            unitPrice: nextPrice,
            originalUnitPrice: nextPrice,
            quantity: clampedQty,
            discount: Math.min(item.discount || 0, roundMmk(nextPrice * clampedQty)),
          };

          const updated = state.items
            .map((it, i) => (i === idx ? nextItem : it))
            .filter((_, i) => i !== duplicateIdx);
          return { items: updated };
        });
      },

      updateItemDiscount: (keyOrProductId: string, discountAmount: number) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (!matchesLine(item, keyOrProductId)) return item;
            const lineGross = roundMmk(item.unitPrice * item.quantity);
            const cleanDiscount = Math.max(0, Math.min(lineGross, roundMmk(discountAmount || 0)));
            return { ...item, discount: cleanDiscount };
          }),
        }));
      },

      clearCart: () => {
        set({
          items: [],
          discount: 0,
          discountType: 'PERCENT',
          promoCode: '',
          activeQuotationId: null,
          activeCustomer: null,
        });
      },

      setPromoCode: (promoCode: string) => {
        set({ promoCode: promoCode.toUpperCase() });
      },

      setActiveCustomer: (activeCustomer: ActiveCartCustomer | null) => {
        set({ activeCustomer });
      },

      loadQuotationItems: (
        quotationId: string,
        items: CartItem[],
        discountFixed = 0,
        customer: ActiveCartCustomer | null = null
      ) => {
        const normalizedItems = items.map((it, idx) => ({
          ...it,
          lineKey: it.lineKey || `${it.productId}:${it.productUnitId ?? 'base'}:q${idx}`,
        }));
        set({
          items: normalizedItems,
          discount: Math.max(0, roundMmk(discountFixed)),
          discountType: discountFixed > 0 ? 'FIXED' : 'PERCENT',
          promoCode: '',
          activeQuotationId: quotationId,
          activeCustomer: customer,
        });
      },

      setDiscount: (amount: number) => {
        const type = get().discountType;
        if (type === 'PERCENT') {
          set({ discount: Math.max(0, Math.min(100, amount)) });
        } else {
          set({ discount: Math.max(0, roundMmk(amount)) });
        }
      },

      setDiscountType: (discountType: DiscountType) => {
        set({ discountType, discount: 0 });
      },

      holdCurrentBill: (label?: string) => {
        const state = get();
        if (state.items.length === 0) return false;
        const held: HeldBill = {
          id: `HOLD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          label: label?.trim() || `Bill #${state.heldBills.length + 1}`,
          items: state.items,
          discount: state.discount,
          discountType: state.discountType,
          promoCode: state.promoCode,
          activeQuotationId: state.activeQuotationId,
          activeCustomer: state.activeCustomer,
          createdAt: new Date().toISOString(),
        };
        set({
          heldBills: [held, ...state.heldBills].slice(0, 25),
          items: [],
          discount: 0,
          discountType: 'PERCENT',
          promoCode: '',
          activeQuotationId: null,
          activeCustomer: null,
        });
        return true;
      },

      resumeHeldBill: (id: string) => {
        const state = get();
        const target = state.heldBills.find((b) => b.id === id);
        if (!target) return;

        let remainingHeld = state.heldBills.filter((b) => b.id !== id);
        if (state.items.length > 0) {
          remainingHeld = [
            {
              id: `HOLD-${Date.now()}`,
              label: `Auto-held Bill`,
              items: state.items,
              discount: state.discount,
              discountType: state.discountType,
              promoCode: state.promoCode,
              activeQuotationId: state.activeQuotationId,
              activeCustomer: state.activeCustomer,
              createdAt: new Date().toISOString(),
            },
            ...remainingHeld,
          ].slice(0, 25);
        }

        set({
          items: target.items,
          discount: target.discount,
          discountType: target.discountType,
          promoCode: target.promoCode ?? '',
          activeQuotationId: target.activeQuotationId ?? null,
          activeCustomer: target.activeCustomer ?? null,
          heldBills: remainingHeld,
        });
      },

      removeHeldBill: (id: string) => {
        set((state) => ({
          heldBills: state.heldBills.filter((b) => b.id !== id),
        }));
      },

      getSubtotal: () => {
        return get().items.reduce(
          (sum, item) => sum + roundMmk(item.unitPrice * item.quantity),
          0
        );
      },

      getItemDiscountTotal: () => {
        return get().items.reduce(
          (sum, item) =>
            sum + Math.min(roundMmk(item.discount || 0), roundMmk(item.unitPrice * item.quantity)),
          0
        );
      },

      getCartDiscountAmount: () => {
        const afterItemDiscount = Math.max(0, get().getSubtotal() - get().getItemDiscountTotal());
        const discount = get().discount;
        if (get().discountType === 'PERCENT') {
          return roundMmk(afterItemDiscount * (discount / 100));
        }
        return Math.min(afterItemDiscount, roundMmk(discount));
      },

      getTotal: () => {
        const afterItemDiscount = Math.max(0, get().getSubtotal() - get().getItemDiscountTotal());
        const cartDiscountAmt = get().getCartDiscountAmount();
        return Math.max(0, afterItemDiscount - cartDiscountAmt);
      },

      getItemCount: () => {
        return roundQuantity(
          get().items.reduce((sum, item) => sum + item.quantity, 0)
        );
      },
    }),
    {
      name: 'shwepos-cart-store',
      partialize: (state) => ({
        items: state.items,
        discount: state.discount,
        discountType: state.discountType,
        promoCode: state.promoCode,
        activeQuotationId: state.activeQuotationId,
        activeCustomer: state.activeCustomer,
        heldBills: state.heldBills,
      }),
    }
  )
);
