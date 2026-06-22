'use client';

import { useState, useCallback } from 'react';
import { useCartStore } from '@/store/cartStore';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

interface PaymentModalProps {
  onClose: () => void;
  onSuccess: (saleData: SaleResponse) => void;
  taxRate: number;
}

interface SaleResponse {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: string;
  notes: string | null;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    total: number;
    product: {
      name: string;
      nameMm: string | null;
      sku: string;
    };
  }>;
  customer: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  user: {
    id: string;
    name: string;
  };
}

type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE_BANKING';

function createClientSaleId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) =>
    (
      Number(c) ^
      (Math.random() * 16) >> (Number(c) / 4)
    ).toString(16)
  );
}

const PAYMENT_METHODS: Array<{
  id: PaymentMethod;
  label: string;
  labelMm: string;
  icon: string;
}> = [
  { id: 'CASH', label: 'Cash', labelMm: 'ငွေသား', icon: '💵' },
  { id: 'CARD', label: 'Card', labelMm: 'ကတ်', icon: '💳' },
  { id: 'MOBILE_BANKING', label: 'Mobile Banking', labelMm: 'မိုဘိုင်းဘလ်', icon: '📱' },
];

export default function PaymentModal({ onClose, onSuccess, taxRate }: PaymentModalProps) {
  const items = useCartStore((s) => s.items);
  const discount = useCartStore((s) => s.discount);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTotal = useCartStore((s) => s.getTotal);
  const getItemCount = useCartStore((s) => s.getItemCount);

  const { language } = useAppStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<
    Array<{ id: string; name: string; phone: string | null }>
  >([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [clientSaleId] = useState(createClientSaleId);

  const subtotal = getSubtotal();
  const afterDiscount = getTotal(); // This is subtotal - discount
  const discountAmount = Math.round(subtotal * (discount / 100));
  const taxAmount = Math.round(afterDiscount * (taxRate / 100));
  const grandTotal = afterDiscount + taxAmount;
  const totalItems = getItemCount();
  const paidAmount = parseFloat(paidAmountStr) || 0;
  const changeAmount = Math.max(0, paidAmount - grandTotal);

  const roundUpAmounts = [
    grandTotal,
    Math.ceil(grandTotal / 100) * 100,
    Math.ceil(grandTotal / 500) * 500,
    Math.ceil(grandTotal / 1000) * 1000,
    Math.ceil(grandTotal / 5000) * 5000,
    Math.ceil(grandTotal / 10000) * 10000,
  ];

  // Remove duplicates and amounts less than total
  const quickAmounts = [...new Set(roundUpAmounts)]
    .filter((a) => a >= grandTotal)
    .slice(0, 5);

  const searchCustomers = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setCustomerResults([]);
        return;
      }
      try {
        const res = await fetch(`/api/customers?search=${encodeURIComponent(query)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setCustomerResults(data.customers || data || []);
        }
      } catch {
        // Silently fail customer search
      }
    },
    []
  );

  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setShowCustomerSearch(true);
    if (value.length === 0) {
      setCustomerId(null);
      setCustomerName(null);
      setCustomerResults([]);
      return;
    }
    searchCustomers(value);
  };

  const selectCustomer = (customer: { id: string; name: string }) => {
    setCustomerId(customer.id);
    setCustomerName(customer.name);
    setCustomerSearch(customer.name);
    setShowCustomerSearch(false);
    setCustomerResults([]);
  };

  const canProcess =
    paymentMethod === 'CASH' ? paidAmount >= grandTotal : paymentReference.trim().length > 0;

  const handleProcess = async () => {
    if (!canProcess || isProcessing) return;

    setIsProcessing(true);
    setError(null);

    const finalPaidAmount = paymentMethod === 'CASH' ? paidAmount : grandTotal;

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            discount: 0,
          })),
          customerId: customerId || null,
          cartDiscount: discountAmount,
          clientSaleId,
          paymentReference: paymentMethod === 'CASH' ? null : paymentReference.trim(),
          paidAmount: finalPaidAmount,
          paymentMethod,
          notes: notes || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process payment');
      }

      const saleData: SaleResponse = await res.json();
      useAppStore.getState().triggerLowStockRefresh();
      onSuccess(saleData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('Payment failed', 'ငွေပေးချေမှုမအောင်မြင်ပါ'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '95vh' }}
      >
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title">💰 {t('Payment', 'ငွေပေးချေမှု')}</span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          {/* Order Summary */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
            }}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-sm)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                {totalItems} {t('item', 'ခု')}{language !== 'mm' && totalItems !== 1 ? 's' : ''}
              </span>
              <span
                style={{
                  fontSize: 'var(--text-2xl)',
                  fontWeight: 800,
                  color: 'var(--primary)',
                }}
              >
                {formatCurrency(grandTotal)}
              </span>
            </div>
            {discountAmount > 0 && (
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--danger)',
                  textAlign: 'right',
                }}
              >
                {t('Discount', 'လျှော့စျေး')}: −{formatCurrency(discountAmount)}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                marginBottom: 'var(--space-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              {t('Payment Method', 'ငွေပေးချေရန်နည်းလမ်း')}
            </div>
            <div className="flex gap-sm">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  className={`btn ${
                    paymentMethod === method.id ? 'btn-primary' : 'btn-secondary'
                  }`}
                  onClick={() => setPaymentMethod(method.id)}
                  type="button"
                  style={{ flex: 1, flexDirection: 'column', padding: '12px 8px' }}
                >
                  <span style={{ fontSize: '20px' }}>{method.icon}</span>
                  <span style={{ fontSize: 'var(--text-xs)' }}>{language === 'mm' ? method.labelMm : method.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cash Amount */}
          {paymentMethod === 'CASH' && (
            <div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  marginBottom: 'var(--space-sm)',
                  color: 'var(--text-secondary)',
                }}
              >
                {t('Cash Received', 'လက်ခံငွေ')}
              </div>
              <input
                type="number"
                className="input"
                placeholder={t('Enter amount...', 'ပမာဏထည့်ပါ...')}
                value={paidAmountStr}
                onChange={(e) => setPaidAmountStr(e.target.value)}
                autoFocus
                min={0}
                style={{
                  fontSize: 'var(--text-xl)',
                  fontWeight: 700,
                  textAlign: 'right',
                  padding: '14px',
                }}
              />

              {/* Quick Cash Buttons */}
              <div
                className="flex gap-sm"
                style={{
                  marginTop: 'var(--space-sm)',
                  flexWrap: 'wrap',
                }}
              >
                {quickAmounts.map((amount) => (
                  <button
                    key={amount}
                    className="btn btn-secondary btn-sm"
                    onClick={() => setPaidAmountStr(amount.toString())}
                    type="button"
                    style={{ flex: '1 1 auto', minWidth: '80px' }}
                  >
                    {amount === grandTotal ? `💯 ${t('Exact', 'အတိအကျ')}` : formatCurrency(amount)}
                  </button>
                ))}
              </div>

              {/* Change Display */}
              {paidAmount >= grandTotal && paidAmount > 0 && (
                <div
                  style={{
                    marginTop: 'var(--space-md)',
                    padding: 'var(--space-md)',
                    background: 'var(--success-light)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-secondary)',
                      marginBottom: '4px',
                    }}
                  >
                    {t('Change', 'ပြန်အမ်းငွေ')}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-2xl)',
                      fontWeight: 800,
                      color: 'var(--success)',
                    }}
                  >
                    {formatCurrency(changeAmount)}
                  </div>
                </div>
              )}
            </div>
          )}

          {paymentMethod !== 'CASH' && (
            <div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  marginBottom: 'var(--space-sm)',
                  color: 'var(--text-secondary)',
                }}
              >
                {t('Payment Reference', 'Payment Reference')}
              </div>
              <input
                type="text"
                className="input"
                placeholder={t('Transaction ID or approval code...', 'Transaction ID or approval code...')}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                maxLength={100}
              />
            </div>
          )}

          {/* Customer (Optional) */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                marginBottom: 'var(--space-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              {t('Customer (Optional)', 'ဖောက်သည် (ရွေးချယ်)')}
            </div>
            <input
              type="text"
              className="input input-search"
              placeholder={t('Search customer...', 'ဖောက်သည်ရှာပါ...')}
              value={customerSearch}
              onChange={(e) => handleCustomerSearchChange(e.target.value)}
              onFocus={() => {
                if (customerResults.length > 0) setShowCustomerSearch(true);
              }}
              onBlur={() => {
                setTimeout(() => setShowCustomerSearch(false), 200);
              }}
            />
            {showCustomerSearch && customerResults.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  marginTop: '4px',
                  zIndex: 10,
                  maxHeight: '160px',
                  overflowY: 'auto',
                }}
              >
                {customerResults.map((c) => (
                  <button
                    key={c.id}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: 'var(--space-sm) var(--space-md)',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      fontSize: 'var(--text-sm)',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                    onClick={() => selectCustomer(c)}
                    type="button"
                  >
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    {c.phone && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                        {c.phone}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
            {customerId && (
              <div
                style={{
                  marginTop: '4px',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--success)',
                }}
              >
                ✓ {t('Selected', 'ရွေးချယ်ပြီး')}: {customerName}
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    marginLeft: '8px',
                    fontSize: 'var(--text-xs)',
                  }}
                  onClick={() => {
                    setCustomerId(null);
                    setCustomerName(null);
                    setCustomerSearch('');
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                marginBottom: 'var(--space-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              {t('Notes (Optional)', 'မှတ်စု (ရွေးချယ်)')}
            </div>
            <input
              type="text"
              className="input"
              placeholder={t('Add a note...', 'မှတ်စုထည့်ပါ...')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {/* Error */}
          {error && (
            <div className="login-error">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={onClose}
            type="button"
            disabled={isProcessing}
          >
            {t('Cancel', 'မလုပ်တော့ပါ')}
          </button>
          <button
            className="btn btn-success btn-lg"
            onClick={handleProcess}
            type="button"
            disabled={!canProcess || isProcessing}
            style={{
              flex: 1,
              opacity: !canProcess || isProcessing ? 0.6 : 1,
              cursor: !canProcess || isProcessing ? 'not-allowed' : 'pointer',
            }}
          >
            {isProcessing ? (
              <span className="flex items-center gap-sm">
                <span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                {t('Processing...', 'ဆောင်ရွက်နေသည်...')}
              </span>
            ) : (
              <>✅ {t('Complete Payment', 'ငွေပေးချေမှုပြီးရန်')} ({formatCurrency(grandTotal)})</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
