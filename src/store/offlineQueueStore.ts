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
      unit?: string;
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
    pointsRedeemed?: number;
    payments?: Array<{ method: string; amount: number; reference?: string | null }>;
    customerName?: string | null;
  };
}

export interface FailedQueuedSale extends QueuedSalePayload {
  errorMessage: string;
  failedAt: string;
}

export interface SyncQueueResult {
  synced: number;
  failed: number;
  authRequired: boolean;
  lastError: string | null;
}

interface OfflineQueueState {
  queuedSales: QueuedSalePayload[];
  failedSales: FailedQueuedSale[];
  isSyncing: boolean;
  enqueueSale: (sale: QueuedSalePayload) => void;
  removeQueuedSale: (clientSaleId: string) => void;
  retryFailedSale: (clientSaleId: string) => void;
  discardFailedSale: (clientSaleId: string) => void;
  syncAllQueuedSales: () => Promise<SyncQueueResult>;
}

export const useOfflineQueueStore = create<OfflineQueueState>()(
  persist(
    (set, get) => ({
      queuedSales: [],
      failedSales: [],
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

      retryFailedSale: (clientSaleId) => {
        set((state) => {
          const target = state.failedSales.find((f) => f.clientSaleId === clientSaleId);
          if (!target) return state;
          const { errorMessage: _err, failedAt: _at, ...rest } = target;
          return {
            failedSales: state.failedSales.filter((f) => f.clientSaleId !== clientSaleId),
            queuedSales: [...state.queuedSales, rest],
          };
        });
      },

      discardFailedSale: (clientSaleId) => {
        set((state) => ({
          failedSales: state.failedSales.filter((f) => f.clientSaleId !== clientSaleId),
        }));
      },

      syncAllQueuedSales: async () => {
        const state = get();
        if (state.isSyncing || state.queuedSales.length === 0) {
          return { synced: 0, failed: 0, authRequired: false, lastError: null };
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          return {
            synced: 0,
            failed: state.queuedSales.length,
            authRequired: false,
            lastError: 'Device is offline',
          };
        }

        set({ isSyncing: true });
        let synced = 0;
        let failed = 0;
        let authRequired = false;
        let lastError: string | null = null;

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
              } else {
                let errMsg = `HTTP ${res.status}`;
                try {
                  const errBody = await res.json();
                  if (errBody?.error) errMsg = String(errBody.error);
                } catch {
                  // keep HTTP status fallback
                }
                lastError = errMsg;

                if (res.status === 401 || res.status === 403) {
                  // Session expired — KEEP in queue and pause sync until user re-authenticates
                  authRequired = true;
                  failed += 1;
                  break;
                } else if (res.status === 409 || res.status === 429 || res.status >= 500) {
                  // Recoverable conflict (e.g., open shift required / stock restock / rate limit / transient 5xx)
                  // KEEP in queuedSales so user can resolve and retry without losing sales
                  failed += 1;
                } else {
                  // 400/422 validation failure — move to persistent failedSales review list (NEVER silently delete)
                  set((prev) => ({
                    queuedSales: prev.queuedSales.filter(
                      (q) => q.clientSaleId !== item.clientSaleId
                    ),
                    failedSales: [
                      {
                        ...item,
                        errorMessage: errMsg,
                        failedAt: new Date().toISOString(),
                      },
                      ...prev.failedSales.filter((f) => f.clientSaleId !== item.clientSaleId),
                    ].slice(0, 50),
                  }));
                  failed += 1;
                }
              }
            } catch {
              failed += 1;
              lastError = 'Network error during sync';
            }
          }
        } finally {
          set({ isSyncing: false });
        }

        return { synced, failed, authRequired, lastError };
      },
    }),
    {
      name: 'shwepos-offline-sales-queue',
      partialize: (state) => ({
        queuedSales: state.queuedSales,
        failedSales: state.failedSales,
      }),
    }
  )
);
