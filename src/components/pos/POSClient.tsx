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
  Keyboard,
  Camera,
  Monitor,
} from '@/components/ui/Icons';
import type { ProductUnit } from '@/types';
import { evaluateBestPromotion, type EvaluablePromotion } from '@/lib/promotionEngine';
import { broadcastCustomerDisplay } from '@/lib/customerDisplayChannel';
import { CameraBarcodeModal } from '@/components/ui/CameraBarcodeModal';
import ProductGrid from '@/components/pos/ProductGrid';
import Cart from '@/components/pos/Cart';
import PaymentModal, { type SaleResponse } from '@/components/pos/PaymentModal';
import Receipt, { type ReceiptData } from '@/components/pos/Receipt';
import { KeyboardShortcutsModal } from '@/components/pos/KeyboardShortcutsModal';

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
  productUnits?: ProductUnit[];
}

interface POSClientProps {
  initialProducts: Product[];
  initialCategories: Category[];
  initialPromotions?: EvaluablePromotion[];
  taxRate: number;
}

export default function POSClient({
  initialProducts,
  initialCategories,
  initialPromotions = [],
  taxRate,
}: POSClientProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [activePromotions, setActivePromotions] = useState<EvaluablePromotion[]>(initialPromotions);
  const [searchQuery, setSearchQuery] = useState('');
  const [showOutOfStock, setShowOutOfStock] = useState(false);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showHeldBillsModal, setShowHeldBillsModal] = useState(false);
  const [showFailedQueueModal, setShowFailedQueueModal] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  // Sync when server re-renders with fresh data (e.g., inventory adjustments)
  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);
  useEffect(() => { setActivePromotions(initialPromotions); }, [initialPromotions]);

  const refreshActivePromotions = useCallback(async () => {
    try {
      const res = await fetch('/api/promotions/active', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setActivePromotions(data);
        } else if (Array.isArray(data?.promotions)) {
          setActivePromotions(data.promotions);
        }
      }
    } catch {
      // keep existing promotions on network error
    }
  }, []);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [focusPaymentCustomer, setFocusPaymentCustomer] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [hasOpenShift, setHasOpenShift] = useState<boolean | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const cartItems = useCartStore((s) => s.items);
  const cartDiscount = useCartStore((s) => s.discount);
  const cartDiscountType = useCartStore((s) => s.discountType);
  const cartPromoCode = useCartStore((s) => s.promoCode);
  const clearCart = useCartStore((s) => s.clearCart);
  const cartItemCount = useCartStore((s) => s.getItemCount());
  const heldBills = useCartStore((s) => s.heldBills);
  const resumeHeldBill = useCartStore((s) => s.resumeHeldBill);
  const removeHeldBill = useCartStore((s) => s.removeHeldBill);

  const queuedSales = useOfflineQueueStore((s) => s.queuedSales);
  const failedSales = useOfflineQueueStore((s) => s.failedSales);
  const isSyncing = useOfflineQueueStore((s) => s.isSyncing);
  const retryFailedSale = useOfflineQueueStore((s) => s.retryFailedSale);
  const discardFailedSale = useOfflineQueueStore((s) => s.discardFailedSale);

  const businessName = useSettingsStore((s) => s.businessName);
  const businessNameMm = useSettingsStore((s) => s.businessNameMm);
  const businessLogo = useSettingsStore((s) => s.logo);
  const { language, t } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;

  const handleRunQueueSync = useCallback(async () => {
    const res = await useOfflineQueueStore.getState().syncAllQueuedSales();
    if (res.synced > 0) {
      addToast(
        tRef.current(
          `Synced ${res.synced} offline sale(s)`,
          `အော့ဖ်လိုင်းအရောင်း ${res.synced} ခု စာရင်းသွင်းပြီးပါပြီ`
        ),
        'success'
      );
      void refreshActivePromotions();
    }
    if (res.authRequired) {
      addToast(
        tRef.current(
          'Session expired — sign in again to sync queued offline sales (your sales are safely kept)',
          'Session သက်တမ်းကုန်သွားပါပြီ — အော့ဖ်လိုင်းအရောင်းများ စာရင်းသွင်းရန် ထပ်မံဝင်ရောက်ပါ (ဒေတာများ လုံခြုံစွာသိမ်းထားပါသည်)'
        ),
        'error'
      );
    } else if (res.failed > 0) {
      addToast(
        res.lastError
          ? `${tRef.current('Offline sync pending', 'အော့ဖ်လိုင်းစာရင်းသွင်းရန် ကျန်ရှိသည်')}: ${res.lastError}`
          : tRef.current(
              `${res.failed} offline sale(s) could not sync yet`,
              `အော့ဖ်လိုင်းအရောင်း ${res.failed} ခု စာရင်းမသွင်းနိုင်သေးပါ`
            ),
        'warning'
      );
    }
  }, [addToast, refreshActivePromotions]);

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
      await handleRunQueueSync();
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
  }, [handleRunQueueSync]);

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

      const q = searchQuery.toLowerCase();
      const matchesSearch =
        searchQuery === '' ||
        product.name.toLowerCase().includes(q) ||
        (product.nameMm && product.nameMm.includes(searchQuery)) ||
        product.sku.toLowerCase().includes(q) ||
        (product.barcode && product.barcode.toLowerCase().includes(q)) ||
        Boolean(
          product.productUnits?.some(
            (u) => u.barcode && u.barcode.toLowerCase().includes(q)
          )
        );

      const matchesCategory =
        selectedCategory === null ||
        product.category.id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory, showOutOfStock]);

  // Broadcast cart / completed state to dual-screen Customer Display (/pos/display)
  useEffect(() => {
    if (showPayment) return; // PaymentModal manages QR broadcast while open
    if (receiptData) {
      broadcastCustomerDisplay({
        mode: 'COMPLETED',
        businessName,
        businessNameMm,
        logo: businessLogo,
        items: [],
        subtotal: receiptData.subtotal,
        discountAmount: receiptData.discountAmount,
        taxAmount: receiptData.taxAmount,
        grandTotal: receiptData.totalAmount,
        paidAmount: receiptData.paidAmount,
        changeAmount: receiptData.changeAmount,
        invoiceNumber: receiptData.invoiceNumber,
        updatedAt: Date.now(),
      });
      return;
    }
    if (cartItems.length === 0) {
      broadcastCustomerDisplay({
        mode: 'IDLE',
        businessName,
        businessNameMm,
        logo: businessLogo,
        items: [],
        subtotal: 0,
        discountAmount: 0,
        taxAmount: 0,
        grandTotal: 0,
        updatedAt: Date.now(),
      });
      return;
    }

    const store = useCartStore.getState();
    const subtotal = store.getSubtotal();
    const itemDisc = store.getItemDiscountTotal();
    const cartDisc = store.getCartDiscountAmount();
    const promoLines = cartItems.map((item) => {
      const gross = Math.round(item.unitPrice * item.quantity);
      return {
        productId: item.productId,
        categoryId: item.categoryId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: Math.max(0, gross - (item.discount || 0)),
      };
    });
    const promoEval = evaluateBestPromotion(promoLines, activePromotions, cartPromoCode, new Date(), cartDisc);
    const afterCartDisc = store.getTotal();
    const promoDisc = Math.min(afterCartDisc, Math.round(promoEval.best?.discountAmount ?? 0));
    const netBeforeTax = Math.max(0, afterCartDisc - promoDisc);
    const taxAmt = Math.round(netBeforeTax * (taxRate / 100));

    broadcastCustomerDisplay({
      mode: 'CART',
      businessName,
      businessNameMm,
      logo: businessLogo,
      items: cartItems.map((i) => ({
        name: i.name,
        nameMm: i.nameMm,
        quantity: i.quantity,
        unit: i.unit,
        unitPrice: i.unitPrice,
        lineTotal: Math.max(0, Math.round(i.unitPrice * i.quantity) - (i.discount || 0)),
      })),
      subtotal,
      discountAmount: itemDisc + cartDisc + promoDisc,
      promoLabel: promoEval.best
        ? language === 'mm' && promoEval.best.promotion.nameMm
          ? promoEval.best.promotion.nameMm
          : promoEval.best.promotion.name
        : null,
      taxAmount: taxAmt,
      grandTotal: netBeforeTax + taxAmt,
      updatedAt: Date.now(),
    });
  }, [
    cartItems,
    cartDiscount,
    cartDiscountType,
    cartPromoCode,
    activePromotions,
    taxRate,
    receiptData,
    showPayment,
    businessName,
    businessNameMm,
    businessLogo,
    language,
  ]);

  const addByScannedCode = useCallback(
    (rawCode: string): boolean => {
      const raw = rawCode.trim();
      if (!raw) return false;
      const lowered = raw.toLowerCase();

      // 1. Check alternate packaging unit barcodes first
      for (const product of products) {
        if (product.stockQuantity <= 0) continue;
        const matchedUnit = product.productUnits?.find(
          (u) => u.barcode && u.barcode.toLowerCase() === lowered
        );
        if (matchedUnit) {
          if (product.stockQuantity < matchedUnit.conversionFactor) {
            return false;
          }
          return useCartStore.getState().addItem(
            {
              id: product.id,
              name: product.name,
              nameMm: product.nameMm,
              sku: product.sku,
              barcode: product.barcode,
              categoryId: product.category.id,
              costPrice: product.costPrice,
              sellingPrice: product.sellingPrice,
              stockQuantity: product.stockQuantity,
              lowStockThreshold: 10,
              unit: product.unit,
              imageUrl: product.imageUrl,
              productUnits: product.productUnits,
              isActive: true,
              createdAt: '',
              updatedAt: '',
            },
            1,
            matchedUnit
          );
        }
      }

      // 2. Check exact product barcode or SKU
      const exactProduct = products.find(
        (p) =>
          p.stockQuantity > 0 &&
          ((p.barcode && p.barcode.toLowerCase() === lowered) ||
            p.sku.toLowerCase() === lowered)
      );
      if (exactProduct) {
        return useCartStore.getState().addItem({
          id: exactProduct.id,
          name: exactProduct.name,
          nameMm: exactProduct.nameMm,
          sku: exactProduct.sku,
          barcode: exactProduct.barcode,
          categoryId: exactProduct.category.id,
          costPrice: exactProduct.costPrice,
          sellingPrice: exactProduct.sellingPrice,
          stockQuantity: exactProduct.stockQuantity,
          lowStockThreshold: 10,
          unit: exactProduct.unit,
          imageUrl: exactProduct.imageUrl,
          productUnits: exactProduct.productUnits,
          isActive: true,
          createdAt: '',
          updatedAt: '',
        });
      }
      return false;
    },
    [products]
  );

  // Barcode / SKU Enter quick-scan handler
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (addByScannedCode(searchQuery)) {
      e.preventDefault();
      setSearchQuery('');
    }
  };

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }
      if (e.key === 'F4') {
        e.preventDefault();
        const store = useCartStore.getState();
        if (store.items.length > 0) {
          store.holdCurrentBill();
          addToast(t('Bill held for later', 'ဘောင်ချာ ခေတ္တဆိုင်းငံ့ပြီးပါပြီ'), 'info');
        } else if (store.heldBills.length > 0) {
          setShowHeldBillsModal(true);
        }
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        const items = useCartStore.getState().items;
        if (items.length > 0) {
          setFocusPaymentCustomer(true);
          setShowPayment(true);
        }
        return;
      }
      if (e.key === 'F9' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        const items = useCartStore.getState().items;
        if (items.length > 0 && !showPayment) {
          setFocusPaymentCustomer(false);
          setShowPayment(true);
        }
        return;
      }
      if (e.key === '?' && !isTypingField) {
        e.preventDefault();
        setShowShortcutsModal((prev) => !prev);
        return;
      }
      if (e.key === 'Escape') {
        if (showShortcutsModal) {
          setShowShortcutsModal(false);
        } else if (showPayment) {
          setShowPayment(false);
          setFocusPaymentCustomer(false);
        } else if (showHeldBillsModal) {
          setShowHeldBillsModal(false);
        } else if (receiptData) {
          handleNewSale();
        }
      }
    },
    [showPayment, showHeldBillsModal, showShortcutsModal, receiptData, addToast, t]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handlePaymentSuccess = (saleData: SaleResponse) => {
    setShowPayment(false);
    setFocusPaymentCustomer(false);
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
        unit: item.unitName || item.product.unit,
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

    // Update stock counts locally after sale (sum across all unit lines for each product)
    const soldItems = useCartStore.getState().items;
    setProducts((prev) =>
      prev.map((product) => {
        const matchingLines = soldItems.filter((si) => si.productId === product.id);
        if (matchingLines.length > 0) {
          const deductedBaseQty = roundQuantity(
            matchingLines.reduce(
              (sum, si) => sum + si.quantity * (si.unitFactor ?? 1),
              0
            )
          );
          return {
            ...product,
            stockQuantity: roundQuantity(Math.max(0, product.stockQuantity - deductedBaseQty)),
          };
        }
        return product;
      })
    );

    clearCart();
    void refreshActivePromotions();
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
              onKeyDown={handleSearchKeyDown}
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
                title={t('Offline mode active — sales will queue locally', 'အော့ဖ်လိုင်းမုဒ် — အရောင်းများကို ယာယီသိမ်းထားပါမည်')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <WifiOff size={12} strokeWidth={2} /> {t('Offline', 'အော့ဖ်လိုင်း')}
              </span>
            )}
            {queuedSales.length > 0 && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void handleRunQueueSync()}
                disabled={isSyncing || !isOnline}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <RefreshCw size={13} strokeWidth={1.75} />
                {isSyncing
                  ? t('Syncing...', 'ချိတ်ဆက်နေသည်...')
                  : `${t('Queued', 'စောင့်ဆိုင်းနေ')} (${queuedSales.length})`}
              </button>
            )}
            {failedSales.length > 0 && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setShowFailedQueueModal(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {t('Failed Sync', 'စာရင်းသွင်းမအောင်')} ({failedSales.length})
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
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowCameraScanner(true)}
              title={t('Scan Barcode with Camera', 'ကင်မရာဖြင့် ဘားကုဒ်ဖတ်ရန်')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
            >
              <Camera size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                window.open('/pos/display', 'shwepos-customer-display', 'width=1024,height=768')
              }
              title={t('Open Customer Display', 'ဖောက်သည်မျက်နှာပြင် ဖွင့်ရန်')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
            >
              <Monitor size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowShortcutsModal(true)}
              title={t('Keyboard Shortcuts (?)', 'ကီးဘုတ်ဖြတ်လမ်းခလုတ်များ (?)')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
            >
              <Keyboard size={14} strokeWidth={1.75} />
              <span>?</span>
            </button>
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
        onOpenPayment={() => {
          void refreshActivePromotions();
          setShowPayment(true);
        }}
        onOpenHeldBills={() => setShowHeldBillsModal(true)}
        taxRate={taxRate}
        activePromotions={activePromotions}
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

      {/* Failed Offline Sync Review Modal */}
      {showFailedQueueModal && (
        <div className="modal-backdrop" onClick={() => setShowFailedQueueModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <span className="modal-title">
                {t('Failed Offline Sales', 'စာရင်းမသွင်းနိုင်သေးသော အော့ဖ်လိုင်းအရောင်းများ')} ({failedSales.length})
              </span>
              <button
                className="btn btn-ghost btn-icon"
                type="button"
                onClick={() => setShowFailedQueueModal(false)}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              {failedSales.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-title">{t('No failed sales', 'မအောင်မြင်သောအရောင်း မရှိပါ')}</div>
                </div>
              ) : (
                failedSales.map((sale) => (
                  <div
                    key={sale.clientSaleId}
                    style={{
                      border: '1px solid var(--danger)',
                      borderRadius: 'var(--radius-md)',
                      padding: 'var(--space-sm) var(--space-md)',
                    }}
                  >
                    <div className="flex justify-between items-center" style={{ marginBottom: 4 }}>
                      <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                        {sale.previewReceipt.invoiceNumber}
                      </strong>
                      <strong style={{ color: 'var(--primary)' }}>
                        {formatCurrency(sale.previewReceipt.totalAmount)}
                      </strong>
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginBottom: 8 }}>
                      {sale.errorMessage}
                    </div>
                    <div className="flex gap-xs">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          retryFailedSale(sale.clientSaleId);
                          void handleRunQueueSync();
                        }}
                      >
                        {t('Retry Sync', 'ထပ်မံစာရင်းသွင်းရန်')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => discardFailedSale(sale.clientSaleId)}
                      >
                        {t('Discard', 'ဖယ်ရှားရန်')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          onClose={() => {
            setShowPayment(false);
            setFocusPaymentCustomer(false);
          }}
          onSuccess={handlePaymentSuccess}
          taxRate={taxRate}
          activePromotions={activePromotions}
          hasOpenShift={hasOpenShift}
          autoFocusCustomer={focusPaymentCustomer}
        />
      )}

      {/* Camera Barcode Scanner */}
      <CameraBarcodeModal
        isOpen={showCameraScanner}
        continuous
        onDetected={(code) => {
          if (addByScannedCode(code)) {
            addToast(`${t('Added', 'ထည့်ပြီး')}: ${code}`, 'success');
          } else {
            addToast(t(`Product not found: ${code}`, `ပစ္စည်းမတွေ့ပါ: ${code}`), 'error');
          }
        }}
        onClose={() => setShowCameraScanner(false)}
      />

      {/* Keyboard Shortcuts Cheat Sheet */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
      />

      {/* Receipt */}
      {receiptData && (
        <Receipt data={receiptData} onNewSale={handleNewSale} />
      )}
    </div>
  );
}
