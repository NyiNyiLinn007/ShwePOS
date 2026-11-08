'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useOfflineQueueStore } from '@/store/offlineQueueStore';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatQuantity, generateInvoiceNumber } from '@/lib/utils';
import {
  PaymentMethodIcon,
  Banknote,
  X,
  AlertTriangle,
  Star,
  CheckCircle2,
} from '@/components/ui/Icons';

interface PaymentModalProps {
  onClose: () => void;
  onSuccess: (saleData: SaleResponse) => void;
  taxRate: number;
  hasOpenShift?: boolean | null;
}

export interface SaleResponse {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount?: number;
  changeAmount: number;
  pointsEarned?: number;
  pointsRedeemed?: number;
  paymentMethod: string;
  notes: string | null;
  isOfflineQueued?: boolean;
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    total: number;
    product: {
      name: string;
      nameMm: string | null;
      sku: string;
      unit?: string;
    };
  }>;
  payments?: Array<{
    method: string;
    amount: number;
    reference?: string | null;
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

type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE_BANKING' | 'CREDIT' | 'SPLIT';
type SingleMethod = 'CASH' | 'CARD' | 'MOBILE_BANKING' | 'CREDIT';

interface SplitLeg {
  method: SingleMethod;
  amountStr: string;
  reference: string;
}

interface CustomerSearchResult {
  id: string;
  name: string;
  phone: string | null;
  loyaltyPoints?: number;
  creditBalance?: number;
  creditLimit?: number | null;
}

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
  labelEn: string;
  labelMm: string;
}> = [
  { id: 'CASH', labelEn: 'Cash', labelMm: 'ငွေသား' },
  { id: 'CARD', labelEn: 'Card', labelMm: 'ကတ်' },
  { id: 'MOBILE_BANKING', labelEn: 'Mobile', labelMm: 'မိုဘိုင်းဘဏ်' },
  { id: 'CREDIT', labelEn: 'Credit', labelMm: 'အကြွေး' },
  { id: 'SPLIT', labelEn: 'Split', labelMm: 'ပေါင်းစပ်' },
];

export default function PaymentModal({ onClose, onSuccess, taxRate, hasOpenShift }: PaymentModalProps) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getItemDiscountTotal = useCartStore((s) => s.getItemDiscountTotal);
  const getCartDiscountAmount = useCartStore((s) => s.getCartDiscountAmount);
  const getTotal = useCartStore((s) => s.getTotal);
  const getItemCount = useCartStore((s) => s.getItemCount);

  const loyaltyEnabled = useSettingsStore((s) => s.loyaltyEnabled);
  const loyaltyRedeemRate = useSettingsStore((s) => s.loyaltyRedeemRate);
  const enqueueSale = useOfflineQueueStore((s) => s.enqueueSale);

  const { language, t } = useI18n();

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [splitLegs, setSplitLegs] = useState<SplitLeg[]>([
    { method: 'CASH', amountStr: '', reference: '' },
    { method: 'MOBILE_BANKING', amountStr: '', reference: '' },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  // Customer selection & quick creation
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>([]);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [showQuickCreateCustomer, setShowQuickCreateCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);

  // Loyalty points redemption
  const [pointsToRedeem, setPointsToRedeem] = useState(0);

  const [clientSaleId] = useState(createClientSaleId);

  const subtotal = getSubtotal();
  const itemDiscountTotal = getItemDiscountTotal();
  const cartDiscountAmount = getCartDiscountAmount();
  const afterCartDiscount = getTotal();
  const maxRedeemablePoints =
    selectedCustomer?.loyaltyPoints && loyaltyRedeemRate > 0
      ? Math.min(
          selectedCustomer.loyaltyPoints,
          Math.floor(afterCartDiscount / loyaltyRedeemRate)
        )
      : 0;
  const safePointsRedeemed = Math.max(0, Math.min(pointsToRedeem, maxRedeemablePoints));
  const loyaltyDiscountAmount = Math.round(safePointsRedeemed * loyaltyRedeemRate);
  const discountAmount = itemDiscountTotal + cartDiscountAmount + loyaltyDiscountAmount;
  const taxableAmount = Math.max(0, afterCartDiscount - loyaltyDiscountAmount);
  const taxAmount = Math.round(taxableAmount * (taxRate / 100));
  const grandTotal = taxableAmount + taxAmount;
  const totalItems = getItemCount();

  const paidAmount = parseFloat(paidAmountStr) || 0;
  const splitTotal = splitLegs.reduce((sum, l) => sum + (parseFloat(l.amountStr) || 0), 0);
  const splitCashTotal = splitLegs
    .filter((l) => l.method === 'CASH')
    .reduce((sum, l) => sum + (parseFloat(l.amountStr) || 0), 0);

  const changeAmount =
    paymentMethod === 'CASH'
      ? Math.max(0, paidAmount - grandTotal)
      : paymentMethod === 'SPLIT'
        ? Math.max(0, splitTotal - grandTotal)
        : 0;

  const creditDueAmount =
    paymentMethod === 'CREDIT'
      ? Math.max(0, grandTotal - Math.min(paidAmount, grandTotal))
      : paymentMethod === 'SPLIT'
        ? splitLegs
            .filter((l) => l.method === 'CREDIT')
            .reduce((sum, l) => sum + (parseFloat(l.amountStr) || 0), 0)
        : 0;

  const roundUpAmounts = [
    grandTotal,
    Math.ceil(grandTotal / 100) * 100,
    Math.ceil(grandTotal / 500) * 500,
    Math.ceil(grandTotal / 1000) * 1000,
    Math.ceil(grandTotal / 5000) * 5000,
    Math.ceil(grandTotal / 10000) * 10000,
  ];

  const quickAmounts = [...new Set(roundUpAmounts)]
    .filter((a) => a >= grandTotal)
    .slice(0, 5);

  const searchCustomers = useCallback(async (query: string) => {
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
  }, []);

  const handleCustomerSearchChange = (value: string) => {
    setCustomerSearch(value);
    setShowCustomerSearch(true);
    if (value.length === 0) {
      setSelectedCustomer(null);
      setPointsToRedeem(0);
      setCustomerResults([]);
      return;
    }
    void searchCustomers(value);
  };

  const selectCustomer = (customer: CustomerSearchResult) => {
    setSelectedCustomer(customer);
    setPointsToRedeem(0);
    setCustomerSearch(customer.name);
    setShowCustomerSearch(false);
    setCustomerResults([]);
  };

  const handleQuickCreateCustomer = async () => {
    if (!newCustomerName.trim()) {
      setError(t('Customer name is required', 'ဖောက်သည်အမည် လိုအပ်ပါသည်'));
      return;
    }
    setCreatingCustomer(true);
    setError(null);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create customer');
      }
      selectCustomer({
        id: data.id,
        name: data.name,
        phone: data.phone,
        loyaltyPoints: data.loyaltyPoints ?? 0,
        creditBalance: data.creditBalance ?? 0,
        creditLimit: data.creditLimit ?? null,
      });
      setShowQuickCreateCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create customer');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const requiresOpenShift =
    (paymentMethod === 'CASH' && grandTotal > 0) ||
    (paymentMethod === 'CREDIT' && paidAmount > 0) ||
    (paymentMethod === 'SPLIT' && splitCashTotal > 0);

  const canProcess = (() => {
    if (requiresOpenShift && hasOpenShift === false) return false;
    if (paymentMethod === 'CASH') return paidAmount >= grandTotal;
    if (paymentMethod === 'CARD' || paymentMethod === 'MOBILE_BANKING') {
      return paymentReference.trim().length > 0;
    }
    if (paymentMethod === 'CREDIT') {
      return Boolean(selectedCustomer) && paidAmount <= grandTotal;
    }
    if (paymentMethod === 'SPLIT') {
      const validLegs = splitLegs.filter((l) => (parseFloat(l.amountStr) || 0) > 0);
      if (validLegs.length === 0) return false;
      for (const leg of validLegs) {
        if ((leg.method === 'CARD' || leg.method === 'MOBILE_BANKING') && !leg.reference.trim()) {
          return false;
        }
        if (leg.method === 'CREDIT' && !selectedCustomer) {
          return false;
        }
      }
      return splitTotal >= grandTotal && splitTotal - grandTotal <= splitCashTotal;
    }
    return false;
  })();

  const handleProcess = async () => {
    if (!canProcess || isProcessing) return;

    setIsProcessing(true);
    setError(null);

    const finalPaidAmount =
      paymentMethod === 'CASH'
        ? paidAmount
        : paymentMethod === 'CREDIT'
          ? Math.min(paidAmount, grandTotal)
          : paymentMethod === 'SPLIT'
            ? splitTotal - creditDueAmount
            : grandTotal;

    const payload = {
      items: items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        discount: item.discount || 0,
      })),
      customerId: selectedCustomer?.id || null,
      cartDiscount: cartDiscountAmount,
      pointsRedeemed: safePointsRedeemed,
      clientSaleId,
      paymentReference:
        paymentMethod === 'CARD' || paymentMethod === 'MOBILE_BANKING' || paymentMethod === 'CREDIT'
          ? paymentReference.trim() || null
          : null,
      paidAmount: finalPaidAmount,
      paymentMethod,
      payments:
        paymentMethod === 'SPLIT'
          ? splitLegs
              .filter((l) => (parseFloat(l.amountStr) || 0) > 0)
              .map((l) => ({
                method: l.method,
                amount: parseFloat(l.amountStr) || 0,
                reference: l.reference.trim() || null,
              }))
          : undefined,
      notes: notes || null,
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to process payment');
      }

      const saleData: SaleResponse = await res.json();
      useAppStore.getState().triggerLowStockRefresh();
      onSuccess(saleData);
    } catch (err) {
      // Offline queue fallback when browser is offline or fetch fails due to network disconnect
      const isNetworkFailure =
        (typeof navigator !== 'undefined' && !navigator.onLine) ||
        err instanceof TypeError;

      if (isNetworkFailure) {
        const offlineInvoice = generateInvoiceNumber();
        const nowIso = new Date().toISOString();
        const offlineItems = items.map((i, idx) => ({
          id: `offline-item-${idx}`,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          discount: i.discount || 0,
          total: Math.max(0, Math.round(i.unitPrice * i.quantity) - (i.discount || 0)),
          product: {
            name: i.name,
            nameMm: i.nameMm,
            sku: i.sku,
            unit: i.unit,
          },
        }));

        enqueueSale({
          clientSaleId,
          queuedAt: nowIso,
          payload,
          previewReceipt: {
            invoiceNumber: offlineInvoice,
            createdAt: nowIso,
            cashierName: 'Offline Cashier',
            items: offlineItems.map((oi) => ({
              name: oi.product.name,
              quantity: oi.quantity,
              unitPrice: oi.unitPrice,
              discount: oi.discount,
              total: oi.total,
            })),
            subtotal,
            discountAmount,
            taxAmount,
            totalAmount: grandTotal,
            paymentMethod,
            paidAmount: finalPaidAmount,
            dueAmount: creditDueAmount,
            changeAmount,
            customerName: selectedCustomer?.name || null,
          },
        });

        onSuccess({
          id: clientSaleId,
          invoiceNumber: offlineInvoice,
          createdAt: nowIso,
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount: grandTotal,
          paidAmount: finalPaidAmount,
          dueAmount: creditDueAmount,
          changeAmount,
          paymentMethod,
          notes: notes || null,
          isOfflineQueued: true,
          items: offlineItems,
          customer: selectedCustomer
            ? { id: selectedCustomer.id, name: selectedCustomer.name, phone: selectedCustomer.phone }
            : null,
          user: { id: 'offline', name: 'Offline Cashier' },
        });
        return;
      }

      setError(err instanceof Error ? err.message : t('Payment failed', 'ငွေပေးချေမှုမအောင်မြင်ပါ'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        aria-label={t('payment')}
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: '95vh' }}
      >
        {/* Header */}
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Banknote size={18} strokeWidth={1.75} />
            {t('payment')}
          </span>
          <button
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            type="button"
            aria-label={t('close')}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {/* Order Summary */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
            }}
          >
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-xs)' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                {formatQuantity(totalItems)} {t('itemUnit')}{language !== 'mm' && totalItems !== 1 ? 's' : ''}
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
                {t('discount')}: −{formatCurrency(discountAmount)}
              </div>
            )}
          </div>

          {/* Payment Method */}
          <div>
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                marginBottom: 'var(--space-xs)',
                color: 'var(--text-secondary)',
              }}
            >
              {t('paymentMethod')}
            </div>
            <div className="flex gap-xs" style={{ flexWrap: 'wrap' }}>
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  className={`btn ${
                    paymentMethod === method.id ? 'btn-primary' : 'btn-secondary'
                  }`}
                  onClick={() => setPaymentMethod(method.id)}
                  type="button"
                  style={{ flex: '1 1 80px', flexDirection: 'column', padding: '10px 6px', gap: 4 }}
                >
                  <PaymentMethodIcon method={method.id} size={18} />
                  <span style={{ fontSize: 'var(--text-xs)' }}>
                    {language === 'mm' ? method.labelMm : method.labelEn}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Shift Warning if Cash is used */}
          {requiresOpenShift && hasOpenShift === false && (
            <div className="shift-payment-block" role="alert">
              <span>{t('cashShiftRequiredPayment')}</span>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={() => {
                  onClose();
                  router.push('/shifts');
                }}
              >
                {t('openShift')}
              </button>
            </div>
          )}

          {/* Cash Amount */}
          {paymentMethod === 'CASH' && (
            <div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  marginBottom: 'var(--space-xs)',
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
                  padding: '12px',
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
                    {amount === grandTotal ? t('Exact', 'အတိအကျ') : formatCurrency(amount)}
                  </button>
                ))}
              </div>

              {/* Change Display */}
              {paidAmount >= grandTotal && paidAmount > 0 && (
                <div
                  style={{
                    marginTop: 'var(--space-sm)',
                    padding: 'var(--space-sm) var(--space-md)',
                    background: 'var(--success-light)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {t('Change', 'ပြန်အမ်းငွေ')}
                  </div>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--success)' }}>
                    {formatCurrency(changeAmount)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Card / Mobile Banking Reference */}
          {(paymentMethod === 'CARD' || paymentMethod === 'MOBILE_BANKING') && (
            <div>
              <div
                style={{
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                  marginBottom: 'var(--space-xs)',
                  color: 'var(--text-secondary)',
                }}
              >
                {t('paymentReference')} *
              </div>
              <input
                type="text"
                className="input"
                placeholder={t('transactionCode')}
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </div>
          )}

          {/* Credit (အကြွေး) Mode */}
          {paymentMethod === 'CREDIT' && (
            <div
              style={{
                padding: 'var(--space-md)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
              }}
            >
              {!selectedCustomer && (
                <div style={{ color: 'var(--warning)', fontSize: 'var(--text-xs)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={14} strokeWidth={1.75} />
                  {t('Please select or create a customer below for credit sales.', 'အကြွေးရောင်းချရန် အောက်တွင် ဖောက်သည်ရွေးချယ်ပါ။')}
                </div>
              )}
              <div className="input-group" style={{ marginBottom: 8 }}>
                <label className="input-label">
                  {t('Upfront Cash Paid (Optional)', 'လက်ငင်းပေးချေငွေ (ရှိပါက)')}
                </label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  max={grandTotal}
                  placeholder="0"
                  value={paidAmountStr}
                  onChange={(e) => setPaidAmountStr(e.target.value)}
                />
              </div>
              <div className="flex justify-between" style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--danger)' }}>
                <span>{t('Remaining Credit Due', 'အကြွေးမှတ်မည့်ပမာဏ')}:</span>
                <span>{formatCurrency(creditDueAmount)}</span>
              </div>
            </div>
          )}

          {/* Split Payment Mode */}
          {paymentMethod === 'SPLIT' && (
            <div
              style={{
                padding: 'var(--space-md)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-sm)',
              }}
            >
              <div className="flex justify-between items-center">
                <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                  {t('Split Payment Legs', 'ပေါင်းစပ်ပေးချေမှု စာရင်း')}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    setSplitLegs([...splitLegs, { method: 'CASH', amountStr: '', reference: '' }])
                  }
                >
                  + {t('Add Leg', 'ထပ်တိုးရန်')}
                </button>
              </div>
              {splitLegs.map((leg, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    className="input"
                    style={{ width: 130, fontSize: 12 }}
                    value={leg.method}
                    onChange={(e) => {
                      const next = [...splitLegs];
                      next[idx] = { ...leg, method: e.target.value as SingleMethod };
                      setSplitLegs(next);
                    }}
                  >
                    <option value="CASH">{t('cash')}</option>
                    <option value="MOBILE_BANKING">{t('mobileBanking')}</option>
                    <option value="CARD">{t('card')}</option>
                    <option value="CREDIT">{t('Credit', 'အကြွေး')}</option>
                  </select>
                  <input
                    type="number"
                    className="input"
                    style={{ width: 120, fontSize: 12 }}
                    placeholder={t('amount')}
                    min={0}
                    value={leg.amountStr}
                    onChange={(e) => {
                      const next = [...splitLegs];
                      next[idx] = { ...leg, amountStr: e.target.value };
                      setSplitLegs(next);
                    }}
                  />
                  {(leg.method === 'CARD' || leg.method === 'MOBILE_BANKING') && (
                    <input
                      type="text"
                      className="input"
                      style={{ flex: 1, minWidth: 110, fontSize: 12 }}
                      placeholder={t('Ref code *', 'လွှဲနံပါတ် *')}
                      value={leg.reference}
                      onChange={(e) => {
                        const next = [...splitLegs];
                        next[idx] = { ...leg, reference: e.target.value };
                        setSplitLegs(next);
                      }}
                    />
                  )}
                  {splitLegs.length > 2 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSplitLegs(splitLegs.filter((_, i) => i !== idx))}
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              ))}
              <div className="flex justify-between" style={{ fontSize: 'var(--text-xs)', paddingTop: 4 }}>
                <span>
                  {t('Covered', 'ပေးချေပြီး')}: {formatCurrency(splitTotal)} / {formatCurrency(grandTotal)}
                </span>
                {splitTotal < grandTotal ? (
                  <span style={{ color: 'var(--danger)', fontWeight: 700 }}>
                    {t('Remaining', 'လိုငွေ')}: {formatCurrency(grandTotal - splitTotal)}
                  </span>
                ) : changeAmount > 0 ? (
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>
                    {t('Change', 'ပြန်အမ်းငွေ')}: {formatCurrency(changeAmount)}
                  </span>
                ) : (
                  <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ Balanced</span>
                )}
              </div>
            </div>
          )}

          {/* Customer Search & Quick Create */}
          <div style={{ position: 'relative' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-xs)' }}>
              <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {t('Customer', 'ဖောက်သည်')} {paymentMethod === 'CREDIT' ? '*' : `(${t('Optional', 'ရွေးချယ်')})`}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ padding: '2px 8px', fontSize: 11 }}
                onClick={() => setShowQuickCreateCustomer(!showQuickCreateCustomer)}
              >
                {showQuickCreateCustomer ? t('cancel') : `+ ${t('New Customer', 'ဖောက်သည်အသစ်')}`}
              </button>
            </div>

            {showQuickCreateCustomer ? (
              <div
                style={{
                  padding: 'var(--space-sm)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                  marginBottom: 6,
                }}
              >
                <input
                  type="text"
                  className="input"
                  style={{ flex: 1, minWidth: 140, fontSize: 12 }}
                  placeholder={`${t('name')} *`}
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                />
                <input
                  type="text"
                  className="input"
                  style={{ flex: 1, minWidth: 120, fontSize: 12 }}
                  placeholder={t('phone')}
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleQuickCreateCustomer}
                  disabled={creatingCustomer}
                >
                  {creatingCustomer ? '...' : t('save')}
                </button>
              </div>
            ) : (
              <input
                type="text"
                className="input input-search"
                placeholder={t('Search customer by name or phone...', 'ဖောက်သည်အမည် သို့မဟုတ် ဖုန်းဖြင့် ရှာပါ...')}
                value={customerSearch}
                onChange={(e) => handleCustomerSearchChange(e.target.value)}
                onFocus={() => {
                  if (customerResults.length > 0) setShowCustomerSearch(true);
                }}
                onBlur={() => {
                  setTimeout(() => setShowCustomerSearch(false), 200);
                }}
              />
            )}

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
                    <div className="flex justify-between">
                      <span style={{ fontWeight: 600 }}>{c.name}</span>
                      {(c.loyaltyPoints ?? 0) > 0 && (
                        <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Star size={11} strokeWidth={1.75} /> {c.loyaltyPoints} pts
                        </span>
                      )}
                    </div>
                    {c.phone && (
                      <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                        {c.phone}
                        {(c.creditBalance ?? 0) > 0
                          ? ` · ${t('Debt', 'ကြွေးကျန်')}: ${formatCurrency(c.creditBalance ?? 0)}`
                          : ''}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {selectedCustomer && (
              <div
                style={{
                  marginTop: '6px',
                  padding: '6px 10px',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--text-xs)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>
                    ✓ {selectedCustomer.name}
                  </span>
                  <span style={{ color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <Star size={11} strokeWidth={1.75} /> {selectedCustomer.loyaltyPoints ?? 0} pts
                    {(selectedCustomer.creditBalance ?? 0) > 0 &&
                      ` · ${t('Debt', 'ကြွေးကျန်')}: ${formatCurrency(selectedCustomer.creditBalance ?? 0)}`}
                  </span>
                </div>
                {loyaltyEnabled && maxRedeemablePoints > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>{t('Redeem pts', 'ပွိုင့်သုံးရန်')}:</span>
                    <input
                      type="number"
                      className="input"
                      style={{ width: 68, padding: '2px 6px', fontSize: 11 }}
                      min={0}
                      max={maxRedeemablePoints}
                      value={pointsToRedeem || ''}
                      onChange={(e) => setPointsToRedeem(Number(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                )}
                <button
                  type="button"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-xs)',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                  onClick={() => {
                    setSelectedCustomer(null);
                    setPointsToRedeem(0);
                    setCustomerSearch('');
                  }}
                >
                  <X size={14} strokeWidth={1.75} />
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
                marginBottom: 'var(--space-xs)',
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
            <div className="login-error" role="alert">{error}</div>
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
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            {isProcessing ? (
              <span className="flex items-center gap-sm">
                <span className="loading-spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                {t('Processing...', 'ဆောင်ရွက်နေသည်...')}
              </span>
            ) : (
              <>
                <CheckCircle2 size={18} strokeWidth={1.75} />
                {t('Complete Payment', 'ငွေပေးချေမှုပြီးရန်')} ({formatCurrency(grandTotal)})
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
