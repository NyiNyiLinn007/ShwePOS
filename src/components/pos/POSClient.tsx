'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useOfflineQueueStore } from '@/store/offlineQueueStore';
import { useToast } from '@/contexts/ToastContext';
import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatDateTime, formatQuantity, roundQuantity } from '@/lib/utils';
import {
  ChevronLeft,
  WifiOff,
  RefreshCw,
  PauseCircle,
  PlayCircle,
  X,
} from '@/components/ui/Icons';
import ProductGrid from '@/components/pos/ProductGrid';
import Cart from '@/components/pos/Cart';
import PaymentModal, { type SaleResponse } from '@/components/pos/PaymentModal';
import Receipt, { type ReceiptData } from '@/components/pos/Receipt';

interface Category {
  id: string;
  name: string;
  nameMm: string | null;
  slug: string;
}

interface Product {
  id: string;
  name: string;
  nameMm: string | null;
  sellingPrice: number;
  costPrice?: number;
  stockQuantity: number;
  sku: string;
  barcode: string | null;
  unit: string;
  imageUrl: string | null;
  category: {
    id: string;
    name: string;
    nameMm: string | null;
  };
}

interface POSClientProps {
  initialProducts: Product[];
  initialCategories: Category[];
  taxRate: number;
}

export default function POSClient({
  initialProducts,
  initialCategories,
  taxRate,
}: POSClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Sync when server re-renders with fresh data (e.g., inventory adjustments)
  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const clearCart = useCartStore((s) => s.clearCart);
  const cartItemCount = useCartStore((s) => s.getItemCount());
  const heldBills = useCartStore((s) => s.heldBills);
  const resumeHeldBill = useCartStore((s) => s.resumeHeldBill);
  const removeHeldBill = useCartStore((s) => s.removeHeldBill);

  const queuedSales = useOfflineQueueStore((s) => s.queuedSales);
  const isSyncing = useOfflineQueueStore((s) => s.isSyncing);
  const syncAllQueuedSales = useOfflineQueueStore((s) => s.syncAllQueuedSales);

  const businessName = useSettingsStore((s) => s.businessName);
  const { t } = useI18n();

  // Full-screen mode: hide sidebar, remove main-content margin
  useEffect(() => {
    document.body.classList.add('pos-fullscreen');
    return () => {
      document.body.classList.remove('pos-fullscreen');
    };
  }, []);

  // Online / Offline listener and automatic queue synchronization
  useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setIsOnline(navigator.onLine);
    }
    const handleOnline = async () => {
      setIsOnline(true);
      const res = await useOfflineQueueStore.getState().syncAllQueuedSales();
      if (res.synced > 0) {
        addToast(
          t(`Synced ${res.synced} offline sale(s)`, `အော့ဖ်လိုင်းအရောင်း ${res.synced} ခု စာရင်းသွင်းပြီးပါပြီ`),
          'success'
        );
      }
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (typeof navigator !== 'undefined' && navigator.onLine && useOfflineQueueStore.getState().queuedSales.length > 0) {
      void handleOnline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [addToast, t]);

  useEffect(() => {
    let active = true;
    fetch('/api/shifts?current=true', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json();
      })
      .then((data) => {
        if (active && data) setHasOpenShift(Boolean(data.current));
      })
      .catch(() => {
        // The API remains the final authority; keep payment available if the status check is unavailable.
      });
    return () => { active = false; };
  }, []);

  // Keep unavailable products available as an optional disabled view.
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (!showOutOfStock && product.stockQuantity <= 0) return false;

      const matchesSearch =
        searchQuery === '' ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.nameMm && product.nameMm.includes(searchQuery)) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.barcode &&
          product.barcode.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === null ||
        product.category.id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory, showOutOfStock]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        const items = useCartStore.getState().items;
        if (items.length > 0) {
          setShowPayment(true);
        }
      }
      if (e.key === 'Escape') {
        if (showPayment) {
          setShowPayment(false);
        } else if (showHeldBillsModal) {
          setShowHeldBillsModal(false);
        } else if (receiptData) {
          handleNewSale();
        }
      }
    },
    [showPayment, showHeldBillsModal, receiptData]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handlePaymentSuccess = (saleData: SaleResponse) => {
    setShowPayment(false);
    setReceiptData({
      invoiceNumber: saleData.invoiceNumber,
      createdAt: saleData.createdAt,
      cashierName: saleData.user.name,
      items: saleData.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
        total: item.total,
        unit: item.product.unit,
      })),
      subtotal: saleData.subtotal,
      discountAmount: saleData.discountAmount,
      taxAmount: saleData.taxAmount,
      totalAmount: saleData.totalAmount,
      paymentMethod: saleData.paymentMethod,
      paidAmount: saleData.paidAmount,
      dueAmount: saleData.dueAmount,
      changeAmount: saleData.changeAmount,
      pointsEarned: saleData.pointsEarned,
      pointsRedeemed: saleData.pointsRedeemed,
      customerName: saleData.customer?.name || null,
      isOfflineQueued: saleData.isOfflineQueued,
      payments: saleData.payments,
    });

    // Update stock counts locally after sale
    const soldItems = useCartStore.getState().items;
    setProducts((prev) =>
      prev.map((product) => {
        const soldItem = soldItems.find((si) => si.productId === product.id);
        if (soldItem) {
          return {
            ...product,
            stockQuantity: roundQuantity(Math.max(0, product.stockQuantity - soldItem.quantity)),
          };
        }
        return product;
      })
    );

    clearCart();
  };

  const handleNewSale = () => {
    setReceiptData(null);
    setSearchQuery('');
    setSelectedCategory(null);
  };

  return (
    <div className="pos-layout">
      {/* LEFT: Products Area */}
      <div className="pos-products">
        {/* Search Header */}
        <div className="pos-products-header">
          <button
            className="pos-exit-btn"
            onClick={() => router.push('/')}
            title={t('exitPos')}
          >
            <ChevronLeft size={16} strokeWidth={2} />
            <span>{businessName}</span>
          </button>
          <div className="pos-search-wrap">
            <label className="sr-only" htmlFor="pos-product-search">{t('searchProducts')}</label>
            <input
              id="pos-product-search"
              ref={searchRef}
              type="search"
              className="input input-search"
              placeholder={t('searchProducts')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            {searchQuery && (
              <button
                className="pos-search-clear"
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label={t('clearProductSearch')}
              >
                <X size={14} strokeWidth={2} />
              </button>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            {!isOnline && (
              <span
                className="badge badge-danger"
                title="Offline mode active — sales will queue locally"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <WifiOff size={12} strokeWidth={2} /> Offline
              </span>
            )}
            {queuedSales.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void syncAllQueuedSales()}
                disabled={isSyncing || !isOnline}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <RefreshCw size={13} strokeWidth={1.75} />
                {isSyncing ? 'Syncing...' : `Queued (${queuedSales.length})`}
              </button>
            )}
            {heldBills.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowHeldBillsModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <PauseCircle size={13} strokeWidth={1.75} />
                {t('Held', 'ဆိုင်းငံ့')} ({heldBills.length})
              </button>
            )}
            <span className="badge badge-neutral">F9 Pay</span>
          </div>
          <div className="pos-toolbar-meta" aria-label={t('posShortcuts')}>
            <span className="pos-key-hint"><kbd>F2</kbd> {t('search')}</span>
            <button
              className={`pos-stock-toggle${showOutOfStock ? ' active' : ''}`}
              type="button"
              aria-pressed={showOutOfStock}
              onClick={() => setShowOutOfStock((visible) => !visible)}
            >
              {showOutOfStock ? t('hideUnavailable') : t('showUnavailable')}
            </button>
          </div>
        </div>

        {/* Shift Banner */}
        <div className={`pos-shift-banner${hasOpenShift === true ? ' is-open' : hasOpenShift === false ? ' is-closed' : ''}`}>
          <span className="pos-shift-dot" aria-hidden="true" />
          {hasOpenShift === true && <span>{t('cashShiftOpen')}</span>}
          {hasOpenShift === false && (
            <>
              <span>{t('cashShiftRequired')}</span>
              <button type="button" onClick={() => router.push('/shifts')}>{t('openShift')}</button>
            </>
          )}
          {hasOpenShift === null && <span>{t('checkingShift')}</span>}
        </div>

        {/* Category Filters */}
        <div className="pos-categories" role="tablist" aria-label={t('productCategories')}>
          <button
            className={`pos-category-btn ${selectedCategory === null ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
            type="button"
            role="tab"
            aria-selected={selectedCategory === null}
          >
            {t('all')}
          </button>
          {initialCategories.map((cat) => (
            <button
              key={cat.id}
              className={`pos-category-btn ${
                selectedCategory === cat.id ? 'active' : ''
              }`}
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === cat.id ? null : cat.id
                )
              }
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat.id}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <ProductGrid products={filteredProducts} />
      </div>

      {/* RIGHT: Cart Panel */}
      {showMobileCart && (
        <button
          className="pos-cart-backdrop"
          type="button"
          onClick={() => setShowMobileCart(false)}
          aria-label={t('close')}
        />
      )}
      <Cart
        onOpenPayment={() => setShowPayment(true)}
        onOpenHeldBills={() => setShowHeldBillsModal(true)}
        taxRate={taxRate}
        isMobileOpen={showMobileCart}
        onClose={() => setShowMobileCart(false)}
      />

      <button
        className="pos-mobile-cart-toggle"
        type="button"
        onClick={() => setShowMobileCart(true)}
        aria-label={`${t('openCart')}${cartItemCount > 0 ? `, ${cartItemCount} ${t('items')}` : ''}`}
      >
        <span aria-hidden="true">{t('cart')}</span>
        {cartItemCount > 0 && <span className="pos-cart-count">{formatQuantity(cartItemCount)}</span>}
        <strong>{t('viewOrder')}</strong>
      </button>

      {/* Held Bills Modal */}
      {showHeldBillsModal && (
        <div className="modal-backdrop" onClick={() => setShowHeldBillsModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <PauseCircle size={18} strokeWidth={1.75} />
                {t('Held Bills', 'ဆိုင်းငံ့ထားသော ဘောင်ချာများ')} ({heldBills.length})
              </span>
              <button
                className="btn btn-ghost btn-icon"
                type="button"
                onClick={() => setShowHeldBillsModal(false)}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {heldBills.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-title">{t('No held bills', 'ဆိုင်းငံ့ဘောင်ချာ မရှိပါ')}</div>
                </div>
              ) : (
                heldBills.map((bill) => {
                  const billSubtotal = bill.items.reduce(
                    (s, i) => s + Math.round(i.unitPrice * i.quantity) - (i.discount || 0),
                    0
                  );
                  return (
                    <div
                      key={bill.id}
                      style={{
                        border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)',
                        padding: 'var(--space-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 'var(--space-md)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700 }}>{bill.label}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {formatDateTime(bill.createdAt)} · {bill.items.length} {t('items')} · {formatCurrency(billSubtotal)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            resumeHeldBill(bill.id);
                            setShowHeldBillsModal(false);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <PlayCircle size={14} strokeWidth={1.75} />
                          {t('Resume', 'ပြန်ယူမည်')}
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => removeHeldBill(bill.id)}
                          aria-label={t('delete')}
                        >
                          <X size={14} strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
          taxRate={taxRate}
          hasOpenShift={hasOpenShift}
        />
      )}

      {/* Receipt */}
      {receiptData && (
        <Receipt data={receiptData} onNewSale={handleNewSale} />
      )}
    </div>
  );
}
