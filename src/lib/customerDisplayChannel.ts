export interface CustomerDisplayLine {
  name: string;
  nameMm?: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
}

export interface CustomerDisplayPayload {
  mode: 'IDLE' | 'CART' | 'PAYMENT_QR' | 'COMPLETED';
  businessName: string;
  businessNameMm?: string | null;
  logo?: string | null;
  items: CustomerDisplayLine[];
  subtotal: number;
  discountAmount: number;
  promoLabel?: string | null;
  taxAmount: number;
  grandTotal: number;
  qrUrl?: string | null;
  qrLabel?: string | null;
  qrPayableAmount?: number;
  paidAmount?: number;
  changeAmount?: number;
  invoiceNumber?: string;
  updatedAt: number;
}

const CHANNEL_NAME = 'shwepos-customer-display-v1';
const STORAGE_KEY = 'shwepos-customer-display-snapshot';

export function broadcastCustomerDisplay(payload: CustomerDisplayPayload): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore storage quota errors
  }
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage(payload);
      ch.close();
    }
  } catch {
    // fallback handled by localStorage storage event
  }
}

export function readCustomerDisplaySnapshot(): CustomerDisplayPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CustomerDisplayPayload;
  } catch {
    return null;
  }
}

export function subscribeCustomerDisplay(
  onUpdate: (payload: CustomerDisplayPayload) => void
): () => void {
  if (typeof window === 'undefined') return () => {};

  let ch: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    ch = new BroadcastChannel(CHANNEL_NAME);
    ch.onmessage = (event) => {
      if (event.data && typeof event.data === 'object') {
        onUpdate(event.data as CustomerDisplayPayload);
      }
    };
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        onUpdate(JSON.parse(event.newValue) as CustomerDisplayPayload);
      } catch {
        // ignore malformed json
      }
    }
  };
  window.addEventListener('storage', handleStorage);

  return () => {
    ch?.close();
    window.removeEventListener('storage', handleStorage);
  };
}
