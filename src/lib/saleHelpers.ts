import { PAYMENT_METHODS, SALE_STATUSES } from '@/lib/constants';
import { formatDateTime } from '@/lib/utils';
import type { ReceiptData } from '@/components/pos/Receipt';

export interface SaleProductRef {
  id?: string;
  name: string;
  nameMm: string | null;
  sku: string;
  barcode?: string | null;
  unit?: string;
}

export interface SaleItemRecord {
  id: string;
  saleId?: string;
  productId: string;
  quantity: number;
  refundedQuantity?: number;
  unitPrice: number;
  costPrice?: number;
  discount: number;
  total: number;
  product?: SaleProductRef;
}

export interface SalePaymentRecord {
  id: string;
  method: string;
  amount: number;
  reference?: string | null;
}

export interface SaleCustomerRef {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
}

export interface SaleUserRef {
  id: string;
  name: string;
}

export interface SaleRecord {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  userId: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  dueAmount?: number;
  pointsEarned?: number;
  pointsRedeemed?: number;
  paymentMethod: string;
  status: string;
  notes: string | null;
  createdAt: string | Date;
  customer?: SaleCustomerRef | null;
  user?: SaleUserRef;
  items?: SaleItemRecord[];
  payments?: SalePaymentRecord[];
}

export type TranslateFn = (keyOrEn: string, mmFallback?: string) => string;

const paymentMethodTranslationKeys: Record<string, string> = {
  CASH: 'cash',
  CARD: 'card',
  MOBILE_BANKING: 'mobileBanking',
  CREDIT: 'credit',
  SPLIT: 'splitPayment',
};

const saleStatusTranslationKeys: Record<string, string> = {
  COMPLETED: 'completed',
  PARTIALLY_REFUNDED: 'partiallyRefunded',
  REFUNDED: 'refunded',
  VOIDED: 'voided',
};

export function getPaymentMethodLabel(method: string, t: TranslateFn): string {
  if (method === 'SPLIT') {
    return t('Split Payment', 'ပေါင်းစပ်ငွေပေးချေမှု');
  }
  const found = PAYMENT_METHODS.find((p) => p.value === method);
  return found ? t(paymentMethodTranslationKeys[method] ?? method) : method;
}

export function getSaleStatusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
      return 'badge-success';
    case 'PARTIALLY_REFUNDED':
    case 'REFUNDED':
      return 'badge-warning';
    case 'VOIDED':
      return 'badge-danger';
    default:
      return 'badge-neutral';
  }
}

export function getSaleStatusLabel(status: string, t: TranslateFn): string {
  if (status === 'PARTIALLY_REFUNDED') {
    return t('Partially Refunded', 'တစ်စိတ်တစ်ပိုင်း ပြန်အမ်းပြီး');
  }
  return SALE_STATUSES.some((s) => s.value === status)
    ? t(saleStatusTranslationKeys[status] ?? status)
    : status;
}

export function buildReceiptDataFromSale(
  sale: SaleRecord,
  language: 'en' | 'mm'
): ReceiptData {
  return {
    invoiceNumber: sale.invoiceNumber,
    createdAt:
      typeof sale.createdAt === 'string'
        ? sale.createdAt
        : sale.createdAt.toISOString(),
    cashierName: sale.user?.name || '—',
    customerName: sale.customer?.name || null,
    items: (sale.items || []).map((item) => ({
      name:
        language === 'mm' && item.product?.nameMm
          ? item.product.nameMm
          : item.product?.name || 'Item',
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount || 0),
      total: Number(item.total),
      unit: item.product?.unit,
    })),
    subtotal: Number(sale.subtotal),
    discountAmount: Number(sale.discountAmount),
    taxAmount: Number(sale.taxAmount),
    totalAmount: Number(sale.totalAmount),
    paymentMethod: sale.paymentMethod,
    paidAmount: Number(sale.paidAmount),
    dueAmount: Number(sale.dueAmount || 0),
    changeAmount: Number(sale.changeAmount),
    pointsEarned: Number(sale.pointsEarned || 0),
    pointsRedeemed: Number(sale.pointsRedeemed || 0),
    payments: (sale.payments || []).map((p) => ({
      method: p.method,
      amount: Number(p.amount),
      reference: p.reference,
    })),
  };
}

export function downloadSalesCsv(sales: SaleRecord[]): void {
  const headers = [
    'Invoice Number',
    'Date & Time',
    'Customer',
    'Cashier',
    'Items',
    'Subtotal',
    'Discount',
    'Tax',
    'Total',
    'Paid',
    'Due',
    'Payment Method',
    'Status',
  ];
  const escapeCsv = (val: string | number) => {
    const str = String(val ?? '');
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };
  const rows = sales.map((s) => [
    s.invoiceNumber,
    formatDateTime(s.createdAt),
    s.customer?.name || 'Walk-in',
    s.user?.name || '—',
    s.items?.length || 0,
    s.subtotal,
    s.discountAmount,
    s.taxAmount,
    s.totalAmount,
    s.paidAmount,
    s.dueAmount || 0,
    s.paymentMethod,
    s.status,
  ]);
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shwepos-sales-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
