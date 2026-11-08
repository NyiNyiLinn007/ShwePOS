'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface QueuedSalePayload {
  clientSaleId: string;
  queuedAt: string;
  payload: Record<string, unknown>;
  previewReceipt: {
    invoiceNumber: string;
    createdAt: string;
    cashierName: string;
    items: Array<{
      name: string;
      quantity: number;
      unitPrice: number;
      discount?: number;
      total: number;
    }>;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    paymentMethod: string;
    paidAmount: number;
    dueAmount?: number;
    changeAmount: number;
    customerName?: string | null;
  };
}

interface OfflineQueueState {
  queuedSales: QueuedSalePayload[];
  isSyncing: boolean;
  enqueueSale: (sale: QueuedSalePayload) => void;
  removeQueuedSale: (clientSaleId: string) => void;
  syncAllQueuedSales: () => Promise<{ synced: number; failed: number }>;
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queuedSales: [],
      isSyncing: false,

      enqueueSale: (sale) => {
        set((state) => {
          if (state.queuedSales.some((q) => q.clientSaleId === sale.clientSaleId)) {
            return state;
          }
          return { queuedSales: [...state.queuedSales, sale] };
        });
      },

      removeQueuedSale: (clientSaleId) => {
        set((state) => ({
          queuedSales: state.queuedSales.filter((q) => q.clientSaleId !== clientSaleId),
        }));
      },

      syncAllQueuedSales: async () => {
        const state = get();
        if (state.isSyncing || state.queuedSales.length === 0) {
          return { synced: 0, failed: 0 };
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          return { synced: 0, failed: state.queuedSales.length };
        }

        set({ isSyncing: true });
        let synced = 0;
        let failed = 0;

        try {
          for (const item of [...state.queuedSales]) {
            try {
              const res = await fetch('/api/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item.payload),
              });
              if (res.ok) {
                get().removeQueuedSale(item.clientSaleId);
                synced += 1;
              } else if (res.status >= 400 && res.status < 500 && res.status !== 429) {
                // Unrecoverable validation/conflict error — remove from queue so it doesn't loop forever
                get().removeQueuedSale(item.clientSaleId);
                failed += 1;
              } else {
                failed += 1;
              }
            } catch {
              failed += 1;
            }
          }
        } finally {
          set({ isSyncing: false });
        }

        return { synced, failed };
      },
    }),
    {
      name: 'shwepos-offline-sales-queue',
      partialize: (state) => ({
        queuedSales: state.queuedSales,
      }),
    }
  )
);
