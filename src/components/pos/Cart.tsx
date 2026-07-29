'use client';

import { useCartStore } from '@/store/cartStore';
import { useI18n } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';

interface CartProps {
  onOpenPayment: () => void;
  taxRate: number;
  isMobileOpen?: boolean;
  onClose?: () => void;
}

export default function Cart({ onOpenPayment, taxRate, isMobileOpen = false, onClose }: CartProps) {
  const { language, t } = useI18n();
  const items = useCartStore((s) => s.items);
  const discount = useCartStore((s) => s.discount);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const setDiscount = useCartStore((s) => s.setDiscount);
  const clearCart = useCartStore((s) => s.clearCart);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTotal = useCartStore((s) => s.getTotal);
  const getItemCount = useCartStore((s) => s.getItemCount);

  const [isEditingDiscount, setIsEditingDiscount] = useState(false);
  const [discountInput, setDiscountInput] = useState('');

  const totalItems = getItemCount();
  const subtotal = getSubtotal();
  const total = getTotal();
  const discountAmount = Math.round(subtotal * (discount / 100));
  const taxAmount = Math.round((subtotal - discountAmount) * (taxRate / 100));
  const grandTotal = total + taxAmount;

  const handleDiscountSubmit = () => {
    const val = parseFloat(discountInput);
    if (!isNaN(val)) {
      setDiscount(val);
    }
    setIsEditingDiscount(false);
  };

  return (
    <div className={`pos-cart${isMobileOpen ? ' is-open' : ''}`}>
      {/* Header */}
      <div className="pos-cart-header">
        <div className="flex items-center gap-sm">
          <span className="pos-cart-title">🛒 {t('cart')}</span>
          {totalItems > 0 && (
            <span className="pos-cart-count">{totalItems}</span>
          )}
        </div>
        {items.length > 0 && (
          <button
            className="btn btn-ghost btn-sm pos-clear-cart"
            onClick={clearCart}
            type="button"
          >
            ✕ {t('clear')}
          </button>
        )}
        {onClose && (
          <button className="btn btn-ghost btn-icon pos-cart-close" onClick={onClose} type="button" aria-label={t('close')}>
            ×
          </button>
        )}
      </div>

      {/* Cart Items */}
      <div className="pos-cart-items">
        {items.length === 0 ? (
          <div className="pos-cart-empty">
            <div className="pos-cart-empty-icon">🛒</div>
            <span>{t('cartEmpty')}</span>
            <span className="mm-text" style={{ fontSize: 'var(--text-xs)' }}>
              {t('Add items to get started', 'ပစ္စည်းများထည့်ပါ')}
            </span>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.productId} className="pos-cart-item">
              <div className="pos-cart-item-info">
                <div className="pos-cart-item-name">{item.name}</div>
                <div className="pos-cart-item-price">
                  {formatCurrency(item.unitPrice)} × {item.quantity}
                </div>
              </div>
              <div className="pos-cart-item-qty">
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  type="button"
                  aria-label={t('decreaseQuantity')}
                >
                  −
                </button>
                <span>{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  type="button"
                  aria-label={t('increaseQuantity')}
                  disabled={item.quantity >= item.maxStock}
                  style={
                    item.quantity >= item.maxStock
                      ? { opacity: 0.4, cursor: 'not-allowed' }
                      : undefined
                  }
                >
                  +
                </button>
              </div>
              <div className="pos-cart-item-total">
                {formatCurrency(item.unitPrice * item.quantity)}
              </div>
              <button
                className="pos-cart-item-remove"
                onClick={() => removeItem(item.productId)}
                type="button"
                aria-label={`${t('removeItem')}: ${item.name}`}
              >
                ✕
              </button>
            </div>
          ))
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
            <div className="pos-cart-summary-row">
              <span
                style={{
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
                onClick={() => {
                  setDiscountInput(discount.toString());
                  setIsEditingDiscount(true);
                }}
              >
                {t('discount')}
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
                      max={100}
                      step={1}
                      style={{
                        width: '60px',
                        padding: '2px 6px',
                        fontSize: 'var(--text-xs)',
                        textAlign: 'right',
                      }}
                    />
                    <span style={{ fontSize: 'var(--text-xs)' }}>%</span>
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    ({discount}%) ✎
                  </span>
                )}
              </span>
              <span style={{ color: discountAmount > 0 ? 'var(--danger)' : undefined }}>
                {discountAmount > 0 ? '−' : ''}{formatCurrency(discountAmount)}
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
          </div>

          {/* Actions */}
          <div className="pos-cart-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={onOpenPayment}
              type="button"
              style={{ flex: 2 }}
            >
              💰 {t('Pay Now', 'ငွေပေးရန်')} ({formatCurrency(grandTotal)})
            </button>
          </div>
        </>
      )}
    </div>
  );
}
