'use client';

import { create } from 'zustand';
import type { CartItem, Product } from '@/types';

interface CartState {
  /** Items currently in the POS cart. */
  items: CartItem[];

  /** Discount percentage (0-100). */
  discount: number;

  /** Add a product to the cart. If the product already exists, its quantity is incremented. */
  addItem: (product: Product, qty?: number) => void;

  /** Remove a product from the cart by product ID. */
  removeItem: (productId: string) => void;

  /** Set the quantity for a specific product in the cart. Removes the item if qty <= 0. */
  updateQuantity: (productId: string, qty: number) => void;

  /** Remove all items from the cart and reset discount. */
  clearCart: () => void;

  /** Set the discount percentage (0-100). */
  setDiscount: (amount: number) => void;

  /** Calculate the subtotal (sum of unitPrice × quantity) before discount. */
  getSubtotal: () => number;

  /** Calculate the final total after applying the discount percentage. */
  getTotal: () => number;

  /** Get the total number of items in the cart. */
  getItemCount: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  discount: 0,

  addItem: (product: Product, qty: number = 1) => {
    set((state) => {
      const existingIndex = state.items.findIndex(
        (item) => item.productId === product.id
      );

      if (existingIndex >= 0) {
        // Product already in cart — increment quantity (capped at available stock)
        const updatedItems = [...state.items];
        const existing = updatedItems[existingIndex];
        const newQty = Math.min(
          existing.quantity + qty,
          existing.maxStock
        );
        updatedItems[existingIndex] = { ...existing, quantity: newQty };
        return { items: updatedItems };
      }

      // New product — add to cart
      const cartItem: CartItem = {
        productId: product.id,
        name: product.name,
        nameMm: product.nameMm,
        sku: product.sku,
        unitPrice: product.sellingPrice,
        costPrice: product.costPrice,
        quantity: Math.min(qty, product.stockQuantity),
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
      if (qty <= 0) {
        return {
          items: state.items.filter((item) => item.productId !== productId),
        };
      }

      return {
        items: state.items.map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.min(qty, item.maxStock) }
            : item
        ),
      };
    });
  },

  clearCart: () => {
    set({ items: [], discount: 0 });
  },

  setDiscount: (amount: number) => {
    set({ discount: Math.max(0, Math.min(100, amount)) });
  },

  getSubtotal: () => {
    return get().items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const discount = get().discount;
    return Math.round(subtotal * (1 - discount / 100));
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },
}));
