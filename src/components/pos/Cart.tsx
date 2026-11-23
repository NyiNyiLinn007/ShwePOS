'use client';

import { useCartStore } from '@/store/cartStore';
import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatQuantity, isFractionalUnit } from '@/lib/utils';
import {
  ShoppingCart,
  PauseCircle,
  X,
  Pencil,
  Banknote,
  AlertTriangle,
  RotateCcw,
} from '@/components/ui/Icons';
import { useState } from 'react';

interface CartProps {
  onOpenPayment: () => void;
  onOpenHeldBills?: () => void;
  taxRate: number;
  isMobileOpen?: boolean;
  onClose?: () => void;
}

export default function Cart({
  onOpenPayment,
  onOpenHeldBills,
  taxRate,
  isMobileOpen = false,
  onClose,
}: CartProps) {
  const { t } = useI18n();
  const items = useCartStore((s) => s.items);
  const discount = useCartStore((s) => s.discount);
  const discountType = useCartStore((s) => s.discountType);
  const heldBills = useCartStore((s) => s.heldBills);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const updateUnitPrice = useCartStore((s) => s.updateUnitPrice);
  const setItemUnit = useCartStore((s) => s.setItemUnit);
  const updateItemDiscount = useCartStore((s) => s.updateItemDiscount);
  const setDiscount = useCartStore((s) => s.setDiscount);
  const setDiscountType = useCartStore((s) => s.setDiscountType);
  const holdCurrentBill = useCartStore((s) => s.holdCurrentBill);
  const clearCart = useCartStore((s) => s.clearCart);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getItemDiscountTotal = useCartStore((s) => s.getItemDiscountTotal);
  const getCartDiscountAmount = useCartStore((s) => s.getCartDiscountAmount);
  const getTotal = useCartStore((s) => s.getTotal);
  const getItemCount = useCartStore((s) => s.getItemCount);

  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [editingQtyProductId, setEditingQtyProductId] = useState<string | null>(null);
  const [qtyInput, setQtyInput] = useState('');
  const [editingPriceProductId, setEditingPriceProductId] = useState<string | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [editingItemDiscountId, setEditingItemDiscountId] = useState<string | null>(null);
  const [itemDiscountInput, setItemDiscountInput] = useState('');

  const totalItems = getItemCount();
  const subtotal = getSubtotal();
  const itemDiscountTotal = getItemDiscountTotal();
  const cartDiscountAmount = getCartDiscountAmount();
  const totalDiscountAmount = itemDiscountTotal + cartDiscountAmount;
  const total = getTotal();
  const taxAmount = Math.round(total * (taxRate / 100));
  const grandTotal = total + taxAmount;

  const handleDiscountSubmit = () => {
    const val = parseFloat(discountInput);
    if (!Number.isNaN(val)) {
      setDiscount(val);
    }
    setIsEditingDiscount(false);
  };

  const handleQtySubmit = (productId: string) => {
    const val = parseFloat(qtyInput);
    if (!Number.isNaN(val) && val > 0) {
      updateQuantity(productId, val);
    }
    setEditingQtyProductId(null);
  };

  const handlePriceSubmit = (productId: string) => {
    const val = parseFloat(priceInput);
    if (!Number.isNaN(val) && val >= 0) {
      updateUnitPrice(productId, val);
    }
    setEditingPriceProductId(null);
  };

  const handleItemDiscountSubmit = (productId: string) => {
    const val = parseFloat(itemDiscountInput);
    if (!Number.isNaN(val) && val >= 0) {
      updateItemDiscount(productId, val);
    }
    setEditingItemDiscountId(null);
  };

  return (
    <div className={`pos-cart${isMobileOpen ? ' is-open' : ''}`}>
      {/* Header */}
      <div className="pos-cart-header">
        <div className="flex items-center gap-sm">
          <span className="pos-cart-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ShoppingCart size={17} strokeWidth={1.75} />
            {t('cart')}
          </span>
          {totalItems > 0 && (
            <span className="pos-cart-count">{formatQuantity(totalItems)}</span>
          )}
        </div>
        <div className="flex items-center gap-xs">
          {heldBills.length > 0 && onOpenHeldBills && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenHeldBills}
              type="button"
              title={t('View held bills', 'ဆိုင်းငံ့ဘောင်ချာများ ကြည့်ရန်')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <PauseCircle size={13} strokeWidth={1.75} />
              {heldBills.length}
            </button>
          )}
          {items.length > 0 && (
            <button
              className="btn btn-ghost btn-sm pos-clear-cart"
              onClick={clearCart}
              type="button"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <X size={13} strokeWidth={1.75} />
              {t('clear')}
            </button>
          )}
          {onClose && (
            <button className="btn btn-ghost btn-icon pos-cart-close" onClick={onClose} type="button" aria-label={t('close')}>
              <X size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      {/* Cart Items */}
      <div className="pos-cart-items">
        {items.length === 0 ? (
          <div className="pos-cart-empty">
            <div className="pos-cart-empty-icon">
              <ShoppingCart size={28} strokeWidth={1.5} />
            </div>
            <span>{t('cartEmpty')}</span>
            <span className="mm-text" style={{ fontSize: 'var(--text-xs)' }}>
              {t('Add items to get started', 'ပစ္စည်းများထည့်ပါ')}
            </span>
          </div>
        ) : (
          items.map((item) => {
            const fractional = isFractionalUnit(item.unit);
            const step = fractional ? 0.5 : 1;
            const factor = item.unitFactor ?? 1;
            const maxForUnit = fractional
              ? item.maxStock / factor
              : Math.floor(item.maxStock / factor + 1e-9);
            const lineGross = Math.round(item.unitPrice * item.quantity);
            const lineDiscount = item.discount || 0;
            const lineNet = Math.max(0, lineGross - lineDiscount);
            const origPrice = item.originalUnitPrice ?? item.unitPrice;
            const isPriceOverridden = item.unitPrice !== origPrice;
            const effectiveUnitCost = (item.costPrice ?? 0) * factor;
            const isBelowCost = effectiveUnitCost > 0 && item.unitPrice < effectiveUnitCost;
            const hasAltUnits = (item.availableUnits?.length ?? 0) > 0;

            return (
              <div key={item.productId} className="pos-cart-item" style={{ flexWrap: 'wrap' }}>
                <div className="pos-cart-item-info" style={{ minWidth: '120px' }}>
                  <div className="pos-cart-item-name" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span>{item.name}</span>
                    {hasAltUnits && (
                      <select
                        className="input"
                        value={item.productUnitId ?? ''}
                        onChange={(e) => setItemUnit(item.productId, e.target.value || null)}
                        title={t('Select packaging unit', 'ထုပ်ပိုးမှုယူနစ် ရွေးရန်')}
                        style={{
                          padding: '1px 6px',
                          fontSize: 11,
                          height: 22,
                          width: 'auto',
                          minWidth: 68,
                          fontWeight: 600,
                        }}
                      >
                        <option value="">{item.baseUnit ?? item.unit}</option>
                        {item.availableUnits!.map((u) => {
                          const canFit = item.maxStock >= u.conversionFactor;
                          return (
                            <option key={u.id} value={u.id} disabled={!canFit}>
                              {u.unitName} (×{formatQuantity(u.conversionFactor)})
                            </option>
                          );
                        })}
                      </select>
                    )}
                  </div>
                  <div className="pos-cart-item-price" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {editingPriceProductId === item.productId ? (
                      <input
                        type="number"
                        className="input"
                        value={priceInput}
                        onChange={(e) => setPriceInput(e.target.value)}
                        onBlur={() => handlePriceSubmit(item.productId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlePriceSubmit(item.productId);
                          if (e.key === 'Escape') setEditingPriceProductId(null);
                        }}
                        autoFocus
                        min={0}
                        placeholder="Price K"
                        style={{ width: 84, padding: '1px 4px', fontSize: 11, textAlign: 'right' }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPriceInput(String(item.unitPrice));
                          setEditingPriceProductId(item.productId);
                        }}
                        title={t('Click to override unit price', 'ဈေးနှုန်းပြင်ရောင်းရန် နှိပ်ပါ')}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: 'inherit',
                          color: isBelowCost ? 'var(--danger)' : isPriceOverridden ? 'var(--warning)' : 'inherit',
                          fontWeight: isPriceOverridden ? 700 : undefined,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <span>{formatCurrency(item.unitPrice)}</span>
                        <Pencil size={10} strokeWidth={1.75} style={{ opacity: 0.7 }} />
                      </button>
                    )}
                    {isPriceOverridden && (
                      <>
                        <span style={{ textDecoration: 'line-through', opacity: 0.55, fontSize: 10 }}>
                          {formatCurrency(origPrice)}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateUnitPrice(item.productId, origPrice)}
                          title={t('Reset to catalog price', 'မူလဈေးသို့ ပြန်ထားရန်')}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          <RotateCcw size={10} strokeWidth={2} />
                        </button>
                      </>
                    )}
                    <span>
                      × {formatQuantity(item.quantity)} {item.unit}
                    </span>
                    {editingItemDiscountId === item.productId ? (
                      <input
                        type="number"
                        className="input"
                        value={itemDiscountInput}
                        onChange={(e) => setItemDiscountInput(e.target.value)}
                        onBlur={() => handleItemDiscountSubmit(item.productId)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleItemDiscountSubmit(item.productId);
                          if (e.key === 'Escape') setEditingItemDiscountId(null);
                        }}
                        autoFocus
                        min={0}
                        max={lineGross}
                        placeholder="Disc K"
                        style={{ width: 72, padding: '1px 4px', fontSize: 11 }}
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setItemDiscountInput(String(lineDiscount || ''));
                          setEditingItemDiscountId(item.productId);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontSize: 11,
                          color: lineDiscount > 0 ? 'var(--danger)' : 'var(--text-muted)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {lineDiscount > 0 ? `−${formatCurrency(lineDiscount)}` : `+${t('discount')}`}
                      </button>
                    )}
                  </div>
                  {isBelowCost && (
                    <div
                      style={{
                        marginTop: 2,
                        fontSize: 10,
                        fontWeight: 700,
                        color: 'var(--danger)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <AlertTriangle size={10} strokeWidth={2} />
                      {t('Below cost price', 'အရင်းဈေးအောက် ရောက်နေသည်')} ({formatCurrency(effectiveUnitCost)})
                    </div>
                  )}
                </div>
                <div className="pos-cart-item-qty">
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity - step)}
                    type="button"
                    aria-label={t('decreaseQuantity')}
                  >
                    −
                  </button>
                  {editingQtyProductId === item.productId ? (
                    <input
                      type="number"
                      className="input"
                      value={qtyInput}
                      onChange={(e) => setQtyInput(e.target.value)}
                      onBlur={() => handleQtySubmit(item.productId)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleQtySubmit(item.productId);
                        if (e.key === 'Escape') setEditingQtyProductId(null);
                      }}
                      autoFocus
                      min={fractional ? 0.01 : 1}
                      max={maxForUnit}
                      step={fractional ? 'any' : 1}
                      style={{ width: 54, padding: '2px 4px', fontSize: 12, textAlign: 'center' }}
                    />
                  ) : (
                    <span
                      onClick={() => {
                        setQtyInput(String(item.quantity));
                        setEditingQtyProductId(item.productId);
                      }}
                      title={t('Click to enter quantity', 'အရေအတွက် ရိုက်ထည့်ရန် နှိပ်ပါ')}
                      style={{ cursor: 'pointer', minWidth: 28, textAlign: 'center' }}
                    >
                      {formatQuantity(item.quantity)}
                    </span>
                  )}
                  <button
                    onClick={() => updateQuantity(item.productId, item.quantity + step)}
                    type="button"
                    aria-label={t('increaseQuantity')}
                    disabled={item.quantity >= maxForUnit}
                    style={
                      item.quantity >= maxForUnit
                        ? { opacity: 0.4, cursor: 'not-allowed' }
                        : undefined
                    }
                  >
                    +
                  </button>
                </div>
                <div className="pos-cart-item-total">
                  {formatCurrency(lineNet)}
                </div>
                <button
                  className="pos-cart-item-remove"
                  onClick={() => removeItem(item.productId)}
                  type="button"
                  aria-label={`${t('removeItem')}: ${item.name}`}
                >
                  <X size={13} strokeWidth={2} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Summary */}
      {items.length > 0 && (
        <>
          <div className="pos-cart-summary">
            <div className="pos-cart-summary-row">
              <span style={{ color: 'var(--text-secondary)' }}>{t('subtotal')}</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {itemDiscountTotal > 0 && (
              <div className="pos-cart-summary-row">
                <span style={{ color: 'var(--text-secondary)' }}>{t('Item Discounts', 'ပစ္စည်းလျှော့ဈေး')}</span>
                <span style={{ color: 'var(--danger)' }}>−{formatCurrency(itemDiscountTotal)}</span>
              </div>
            )}
            <div className="pos-cart-summary-row">
              <span
                style={{
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setDiscountInput(discount.toString());
                    setIsEditingDiscount(true);
                  }}
                >
                  {t('discount')}
                </span>
                <button
                  type="button"
                  className="badge badge-neutral"
                  style={{ cursor: 'pointer', border: 'none', padding: '1px 6px', fontSize: 10 }}
                  onClick={() => setDiscountType(discountType === 'PERCENT' ? 'FIXED' : 'PERCENT')}
                  title={t('Toggle % or Kyat discount', '% သို့မဟုတ် ကျပ်ဂဏန်း လျှော့ဈေးပြောင်းရန်')}
                >
                  {discountType === 'PERCENT' ? '%' : 'K'}
                </button>
                {isEditingDiscount ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <input
                      type="number"
                      className="input"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      onBlur={handleDiscountSubmit}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleDiscountSubmit();
                        if (e.key === 'Escape') setIsEditingDiscount(false);
                      }}
                      autoFocus
                      min={0}
                      max={discountType === 'PERCENT' ? 100 : subtotal}
                      step={1}
                      style={{
                        width: '72px',
                        padding: '2px 6px',
                        fontSize: 'var(--text-xs)',
                        textAlign: 'right',
                      }}
                    />
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 3,
                    }}
                    onClick={() => {
                      setDiscountInput(discount.toString());
                      setIsEditingDiscount(true);
                    }}
                  >
                    ({discountType === 'PERCENT' ? `${discount}%` : formatCurrency(discount)}) <Pencil size={11} strokeWidth={1.75} />
                  </span>
                )}
              </span>
              <span style={{ color: cartDiscountAmount > 0 ? 'var(--danger)' : undefined }}>
                {cartDiscountAmount > 0 ? '−' : ''}{formatCurrency(cartDiscountAmount)}
              </span>
            </div>
            {taxRate > 0 && (
              <div className="pos-cart-summary-row">
                <span style={{ color: 'var(--text-secondary)' }}>{t('Tax', 'အခွန်')} ({taxRate}%)</span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="pos-cart-summary-row total">
              <span>{t('Total', 'စုစုပေါင်း')}</span>
              <span>{formatCurrency(grandTotal)}</span>
            </div>
            {totalDiscountAmount > 0 && (
              <div style={{ fontSize: 11, color: 'var(--success)', textAlign: 'right' }}>
                {t('Total Saved', 'စုစုပေါင်းသက်သာငွေ')}: {formatCurrency(totalDiscountAmount)}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pos-cart-actions" style={{ display: 'flex', gap: 'var(--space-xs)' }}>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => holdCurrentBill()}
              type="button"
              style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              title={t('Hold this bill for later', 'ဘောင်ချာ ခေတ္တဆိုင်းငံ့ထားရန်')}
            >
              <PauseCircle size={16} strokeWidth={1.75} />
              {t('Hold', 'ဆိုင်းငံ့')}
            </button>
            <button
              className="btn btn-primary btn-lg"
              onClick={onOpenPayment}
              type="button"
              style={{ flex: 2, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Banknote size={17} strokeWidth={1.75} />
              {t('Pay Now', 'ငွေပေးရန်')} ({formatCurrency(grandTotal)})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
