'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product, ProductUnit } from '@/types';
import { isFractionalUnit, roundQuantity } from '@/lib/utils';

export type DiscountType = 'PERCENT' | 'FIXED';

export interface HeldBill {
  id: string;
  label: string;
  items: CartItem[];
  discount: number;
  discountType: DiscountType;
  createdAt: string;
}

function getMaxQtyForUnit(maxStock: number, unit: string, factor: number): number {
  const safeFactor = factor > 0 ? factor : 1;
  const raw = maxStock / safeFactor;
  return isFractionalUnit(unit) ? roundQuantity(raw) : Math.floor(raw + 1e-9);
}

interface CartState {
  /** Items currently in the POS cart. */
  items: CartItem[];

  /** Cart-level discount value (0-100 if PERCENT, or Kyat amount if FIXED). */
  discount: number;

  /** Whether cart discount is PERCENT (%) or FIXED (Kyat). */
  discountType: DiscountType;

  /** Parked/held bills that can be resumed later. */
  heldBills: HeldBill[];

  /** Add a product to the cart (optionally in a specific alternate packaging unit). */
  addItem: (product: Product, qty?: number, unitOverride?: ProductUnit | null) => void;

  /** Remove a product from the cart by product ID. */
  removeItem: (productId: string) => void;

  /** Set the quantity for a specific product in the cart. Removes the item if qty <= 0. */
  updateQuantity: (productId: string, qty: number) => void;

  /** Override the unit selling price for a specific cart item (wholesale / negotiation). */
  updateUnitPrice: (productId: string, newPrice: number) => void;

  /** Switch a cart item between base unit (null) and an alternate ProductUnit ID. */
  setItemUnit: (productId: string, productUnitId: string | null) => void;

  /** Set item-level discount (in Kyat) for a specific product in the cart. */
  updateItemDiscount: (productId: string, discountAmount: number) => void;

  /** Remove all items from the cart and reset discount. */
  clearCart: () => void;

  /** Set the cart discount value. */
  setDiscount: (amount: number) => void;

  /** Set the cart discount type ('PERCENT' or 'FIXED'). */
  setDiscountType: (type: DiscountType) => void;

  /** Hold/park the current cart so another customer can be served. */
  holdCurrentBill: (label?: string) => boolean;

  /** Resume a held bill by ID (replaces current cart; if current cart has items, holds it first). */
  resumeHeldBill: (id: string) => void;

  /** Delete a held bill by ID. */
  removeHeldBill: (id: string) => void;

  /** Calculate the gross subtotal (sum of unitPrice * quantity) before any discounts. */
  getSubtotal: () => number;

  /** Calculate total of per-item discounts. */
  getItemDiscountTotal: () => number;

  /** Calculate the cart-level discount amount in Kyat. */
  getCartDiscountAmount: () => number;

  /** Calculate the final total after applying both item and cart discounts (before tax). */
  getTotal: () => number;

  /** Get the total number of items (or lines) in the cart. */
  getItemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      discount: 0,
      discountType: 'PERCENT',
      heldBills: [],

      addItem: (product: Product, qty: number = 1, unitOverride?: ProductUnit | null) => {
        set((state) => {
          const activeUnitName = unitOverride ? unitOverride.unitName : product.unit;
          const factor = unitOverride ? unitOverride.conversionFactor : 1;
          const activePrice = unitOverride ? unitOverride.sellingPrice : product.sellingPrice;
          const maxForUnit = getMaxQtyForUnit(product.stockQuantity, activeUnitName, factor);
          if (maxForUnit <= 0) return state;

          const stepQty = isFractionalUnit(activeUnitName)
            ? roundQuantity(qty)
            : Math.max(1, Math.round(qty));

          const existingIndex = state.items.findIndex(
            (item) => item.productId === product.id
          );

          if (existingIndex >= 0) {
            const updatedItems = [...state.items];
            const existing = updatedItems[existingIndex];
            const existingUnitId = existing.productUnitId ?? null;
            const targetUnitId = unitOverride?.id ?? null;

            if (existingUnitId === targetUnitId) {
              const existingMax = getMaxQtyForUnit(
                existing.maxStock,
                existing.unit,
                existing.unitFactor ?? 1
              );
              const newQty = roundQuantity(
                Math.min(existing.quantity + stepQty, existingMax)
              );
              updatedItems[existingIndex] = { ...existing, quantity: newQty };
            } else {
              // Switched packaging via alternate barcode scan
              const clampedQty = roundQuantity(Math.min(stepQty, maxForUnit));
              updatedItems[existingIndex] = {
                ...existing,
                unit: activeUnitName,
                productUnitId: targetUnitId,
                unitFactor: factor,
                unitPrice: activePrice,
                originalUnitPrice: activePrice,
                quantity: clampedQty,
                discount: Math.min(existing.discount || 0, Math.round(activePrice * clampedQty)),
              };
            }
            return { items: updatedItems };
          }

          const cartItem: CartItem = {
            productId: product.id,
            name: product.name,
            nameMm: product.nameMm,
            sku: product.sku,
            unitPrice: activePrice,
            originalUnitPrice: activePrice,
            baseSellingPrice: product.sellingPrice,
            costPrice: product.costPrice,
            quantity: roundQuantity(Math.min(stepQty, maxForUnit)),
            discount: 0,
            maxStock: product.stockQuantity,
            unit: activeUnitName,
            baseUnit: product.unit,
            productUnitId: unitOverride?.id ?? null,
            unitFactor: factor,
            availableUnits: product.productUnits ?? [],
            imageUrl: product.imageUrl,
          };

          return { items: [...state.items, cartItem] };
        });
      },

      removeItem: (productId: string) => {
        set((state) => ({
          items: state.items.filter((item) => item.productId !== productId),
        }));
      },

      updateQuantity: (productId: string, qty: number) => {
        set((state) => {
          const rounded = roundQuantity(qty);
          if (rounded <= 0) {
            return {
              items: state.items.filter((item) => item.productId !== productId),
            };
          }

          return {
            items: state.items.map((item) => {
              if (item.productId !== productId) return item;
              const normalizedQty = isFractionalUnit(item.unit)
                ? rounded
                : Math.max(1, Math.round(rounded));
              const maxForUnit = getMaxQtyForUnit(
                item.maxStock,
                item.unit,
                item.unitFactor ?? 1
              );
              const clampedQty = roundQuantity(Math.min(normalizedQty, Math.max(0, maxForUnit)));
              const maxLineTotal = Math.round(item.unitPrice * clampedQty);
              return {
                ...item,
                quantity: clampedQty,
                discount: Math.min(item.discount || 0, maxLineTotal),
              };
            }),
          };
        });
      },

      updateUnitPrice: (productId: string, newPrice: number) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.productId !== productId) return item;
            const cleanPrice = Math.max(0, Math.round(newPrice));
            const maxLineTotal = Math.round(cleanPrice * item.quantity);
            return {
              ...item,
              originalUnitPrice: item.originalUnitPrice ?? item.unitPrice,
              unitPrice: cleanPrice,
              discount: Math.min(item.discount || 0, maxLineTotal),
            };
          }),
        }));
      },

      setItemUnit: (productId: string, productUnitId: string | null) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.productId !== productId) return item;
            const units = item.availableUnits ?? [];

            if (!productUnitId) {
              // Revert to base unit using stored baseSellingPrice
              const baseUnit = item.baseUnit ?? item.unit;
              const basePrice =
                item.baseSellingPrice ??
                item.originalUnitPrice ??
                item.unitPrice;
              const maxBase = getMaxQtyForUnit(item.maxStock, baseUnit, 1);
              const clampedQty = roundQuantity(Math.max(isFractionalUnit(baseUnit) ? 0.5 : 1, Math.min(item.quantity, maxBase)));
              return {
                ...item,
                productUnitId: null,
                unit: baseUnit,
                unitFactor: 1,
                unitPrice: basePrice,
                originalUnitPrice: basePrice,
                quantity: clampedQty,
                discount: Math.min(item.discount || 0, Math.round(basePrice * clampedQty)),
              };
            }

            const targetUnit = units.find((u) => u.id === productUnitId);
            if (!targetUnit) return item;

            const maxForUnit = getMaxQtyForUnit(
              item.maxStock,
              targetUnit.unitName,
              targetUnit.conversionFactor
            );
            if (maxForUnit <= 0) return item;

            const clampedQty = roundQuantity(Math.max(1, Math.min(item.quantity, maxForUnit)));
            return {
              ...item,
              productUnitId: targetUnit.id,
              unit: targetUnit.unitName,
              unitFactor: targetUnit.conversionFactor,
              unitPrice: targetUnit.sellingPrice,
              originalUnitPrice: targetUnit.sellingPrice,
              quantity: clampedQty,
              discount: Math.min(
                item.discount || 0,
                Math.round(targetUnit.sellingPrice * clampedQty)
              ),
            };
          }),
        }));
      },

      updateItemDiscount: (productId: string, discountAmount: number) => {
        set((state) => ({
          items: state.items.map((item) => {
            if (item.productId !== productId) return item;
            const lineGross = Math.round(item.unitPrice * item.quantity);
            const cleanDiscount = Math.max(0, Math.min(lineGross, Math.round(discountAmount || 0)));
            return { ...item, discount: cleanDiscount };
          }),
        }));
      },

      clearCart: () => {
        set({ items: [], discount: 0, discountType: 'PERCENT' });
      },

      setDiscount: (amount: number) => {
        const type = get().discountType;
        if (type === 'PERCENT') {
          set({ discount: Math.max(0, Math.min(100, amount)) });
        } else {
          set({ discount: Math.max(0, Math.round(amount)) });
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
          createdAt: new Date().toISOString(),
        };
        set({
          heldBills: [held, ...state.heldBills].slice(0, 25),
          items: [],
          discount: 0,
          discountType: 'PERCENT',
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
              createdAt: new Date().toISOString(),
            },
            ...remainingHeld,
          ].slice(0, 25);
        }

        set({
          items: target.items,
          discount: target.discount,
          discountType: target.discountType,
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
          (sum, item) => sum + Math.round(item.unitPrice * item.quantity),
          0
        );
      },

      getItemDiscountTotal: () => {
        return get().items.reduce(
          (sum, item) => sum + Math.min(item.discount || 0, Math.round(item.unitPrice * item.quantity)),
          0
        );
      },

      getCartDiscountAmount: () => {
        const afterItemDiscount = Math.max(0, get().getSubtotal() - get().getItemDiscountTotal());
        const discount = get().discount;
        if (get().discountType === 'PERCENT') {
          return Math.round(afterItemDiscount * (discount / 100));
        }
        return Math.min(afterItemDiscount, Math.round(discount));
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
        heldBills: state.heldBills,
      }),
    }
  )
);
