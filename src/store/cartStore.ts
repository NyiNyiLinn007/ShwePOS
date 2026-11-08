'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, Product } from '@/types';
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

interface CartState {
  /** Items currently in the POS cart. */
  items: CartItem[];

  /** Cart-level discount value (0-100 if PERCENT, or Kyat amount if FIXED). */
  discount: number;

  /** Whether cart discount is PERCENT (%) or FIXED (Kyat). */
  discountType: DiscountType;

  /** Parked/held bills that can be resumed later. */
  heldBills: HeldBill[];

  /** Add a product to the cart. If the product already exists, its quantity is incremented. */
  addItem: (product: Product, qty?: number) => void;

  /** Remove a product from the cart by product ID. */
  removeItem: (productId: string) => void;

  /** Set the quantity for a specific product in the cart. Removes the item if qty <= 0. */
  updateQuantity: (productId: string, qty: number) => void;

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

      addItem: (product: Product, qty: number = 1) => {
        set((state) => {
          const stepQty = isFractionalUnit(product.unit) ? roundQuantity(qty) : Math.max(1, Math.round(qty));
          const existingIndex = state.items.findIndex(
            (item) => item.productId === product.id
          );

          if (existingIndex >= 0) {
            const updatedItems = [...state.items];
            const existing = updatedItems[existingIndex];
            const newQty = roundQuantity(
              Math.min(existing.quantity + stepQty, existing.maxStock)
            );
            updatedItems[existingIndex] = { ...existing, quantity: newQty };
            return { items: updatedItems };
          }

          const cartItem: CartItem = {
            productId: product.id,
            name: product.name,
            nameMm: product.nameMm,
            sku: product.sku,
            unitPrice: product.sellingPrice,
            costPrice: product.costPrice,
            quantity: roundQuantity(Math.min(stepQty, product.stockQuantity)),
            discount: 0,
            maxStock: product.stockQuantity,
            unit: product.unit,
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
              const clampedQty = roundQuantity(Math.min(normalizedQty, item.maxStock));
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
