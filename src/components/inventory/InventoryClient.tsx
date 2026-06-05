'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/contexts/ToastContext';
import { formatDateTime } from '@/lib/utils';
import { STOCK_MOVEMENT_TYPES } from '@/lib/constants';

/* ---------- Types ---------- */

interface ProductCategory {
  id: string;
  name: string;
  nameMm: string | null;
}

interface InventoryProduct {
  id: string;
  name: string;
  nameMm: string | null;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  imageUrl: string | null;
  isActive: boolean;
  category: ProductCategory;
}

interface MovementProduct {
  id: string;
  name: string;
  nameMm: string | null;
  sku: string;
  unit: string;
}

interface MovementUser {
  id: string;
  name: string;
}

interface StockMovementData {
  id: string;
  productId: string;
  userId: string;
  quantity: number;
  type: string;
  reason: string | null;
  previousStock: number;
  newStock: number;
  createdAt: string | Date;
  product?: MovementProduct;
  user?: MovementUser;
}

interface AdjustmentForm {
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: string;
  reason: string;
}

/* ---------- Constants ---------- */

const ITEMS_PER_PAGE = 15;

const emptyAdjustment: AdjustmentForm = {
  type: 'IN',
  quantity: '',
  reason: '',
};

/* ---------- Component ---------- */

interface InventoryClientProps {
  initialProducts: InventoryProduct[];
  initialMovements: StockMovementData[];
}

export function InventoryClient({
  initialProducts,
  initialMovements,
}: InventoryClientProps) {
  const { addToast } = useToast();
  const { language } = useAppStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);

  // State
  const [products, setProducts] = useState<InventoryProduct[]>(initialProducts);
  const [movements, setMovements] = useState<StockMovementData[]>(initialMovements);
  // Sync when server re-renders with fresh data
  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);
  useEffect(() => { setMovements(initialMovements); }, [initialMovements]);
  const [activeTab, setActiveTab] = useState<'levels' | 'movements'>('levels');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [movementTypeFilter, setMovementTypeFilter] = useState('');
  const [movementDateFrom, setMovementDateFrom] = useState('');
  const [movementDateTo, setMovementDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [adjustTarget, setAdjustTarget] = useState<InventoryProduct | null>(null);
  const [adjustForm, setAdjustForm] = useState<AdjustmentForm>(emptyAdjustment);
  const [adjustErrors, setAdjustErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Reset page when tab changes
  const handleTabChange = useCallback((tab: 'levels' | 'movements') => {
    setActiveTab(tab);
    setCurrentPage(1);
  }, []);

  // Stock Levels Filtering
  const filteredProducts = useMemo(() => {
    switch (stockFilter) {
      case 'low':
        return products.filter(
          (p) =>
            p.stockQuantity > 0 &&
            p.stockQuantity <= p.lowStockThreshold
        );
      case 'out':
        return products.filter((p) => p.stockQuantity <= 0);
      default:
        return products;
    }
  }, [products, stockFilter]);

  // Stock Movements Filtering
  const filteredMovements = useMemo(() => {
    let result = movements;

    if (movementTypeFilter) {
      result = result.filter((m) => m.type === movementTypeFilter);
    }

    if (movementDateFrom) {
      const from = new Date(movementDateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((m) => new Date(m.createdAt) >= from);
    }

    if (movementDateTo) {
      const to = new Date(movementDateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((m) => new Date(m.createdAt) <= to);
    }

    return result;
  }, [movements, movementTypeFilter, movementDateFrom, movementDateTo]);

  // Pagination
  const currentData = activeTab === 'levels' ? filteredProducts : filteredMovements;
  const totalPages = Math.max(1, Math.ceil(currentData.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedData = currentData.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  // Stock status helpers
  function getStockStatus(product: InventoryProduct): { label: string; className: string } {
    if (product.stockQuantity <= 0) {
      return { label: t('Out of Stock', 'ကုန်ပစ္စည်းကုန်'), className: 'badge-danger' };
    }
    if (product.stockQuantity <= product.lowStockThreshold) {
      return { label: t('Low Stock', 'ကုန်လက်ကျန်နည်း'), className: 'badge-warning' };
    }
    return { label: t('In Stock', 'ကုန်လက်ကျန်ရှိ'), className: 'badge-success' };
  }

  function getMovementTypeBadge(type: string): { label: string; className: string; icon: string } {
    const found = STOCK_MOVEMENT_TYPES.find((t) => t.value === type);
    if (found) {
      let className = 'badge-primary';
      if (type === 'IN' || type === 'RETURN') className = 'badge-success';
      if (type === 'OUT') className = 'badge-danger';
      if (type === 'ADJUSTMENT') className = 'badge-warning';
      return { label: found.label, className, icon: found.icon };
    }
    return { label: type, className: 'badge-neutral', icon: '📦' };
  }

  // Adjust Stock Modal
  function openAdjustModal(product: InventoryProduct) {
    setAdjustTarget(product);
    setAdjustForm(emptyAdjustment);
    setAdjustErrors({});
  }

  function closeAdjustModal() {
    setAdjustTarget(null);
    setAdjustForm(emptyAdjustment);
    setAdjustErrors({});
  }

  function handleAdjustFormChange(field: keyof AdjustmentForm, value: string) {
    setAdjustForm((prev) => ({ ...prev, [field]: value }));
    if (adjustErrors[field]) {
      setAdjustErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validateAdjustment(): boolean {
    const errors: Record<string, string> = {};
    const qty = Number(adjustForm.quantity);

    if (!adjustForm.quantity || isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) {
      errors.quantity = t('Quantity must be a positive integer', 'အရေအတွက်သည် အပြုကိန်းပြည့်ဖြစ်ရပါမည်');
    }

    if (adjustForm.type === 'OUT' && adjustTarget) {
      if (qty > adjustTarget.stockQuantity) {
        errors.quantity = t(`Cannot exceed current stock (${adjustTarget.stockQuantity})`, `လက်ရှိကုန်လက်ကျန် (${adjustTarget.stockQuantity}) ထက်မကျော်ရပါ`);
      }
    }

    if (!adjustForm.reason.trim()) {
      errors.reason = t('Reason is required', 'အကြောင်းပြချက်ထည့်ရန်လိုပါသည်');
    }

    setAdjustErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleAdjustSubmit() {
    if (!adjustTarget || !validateAdjustment()) return;
    setSaving(true);

    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: adjustTarget.id,
          quantity: Number(adjustForm.quantity),
          type: adjustForm.type,
          reason: adjustForm.reason.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || t('Failed to adjust stock', 'ကုန်လက်ကျန်ချိန်ညှိမရပါ'), 'error');
        return;
      }

      // Update product stock locally
      setProducts((prev) =>
        prev.map((p) =>
          p.id === adjustTarget.id
            ? { ...p, stockQuantity: data.newStock }
            : p
        )
      );

      // Add movement to list
      setMovements((prev) => [data, ...prev]);

      addToast(t('Stock adjusted successfully', 'ကုန်လက်ကျန်ချိန်ညှိပြီးပါပြီ'), 'success');
      useAppStore.getState().triggerLowStockRefresh();
      closeAdjustModal();
    } catch {
      addToast(t('Network error. Please try again.', 'ကွန်ရက်ချို့ယွင်းချက်။ ထပ်ကြိုးစားပါ။'), 'error');
    } finally {
      setSaving(false);
    }
  }

  // Summary stats
  const stockSummary = useMemo(() => {
    const lowStock = products.filter(
      (p) => p.stockQuantity > 0 && p.stockQuantity <= p.lowStockThreshold
    ).length;
    const outOfStock = products.filter((p) => p.stockQuantity <= 0).length;
    return {
      total: products.length,
      inStock: products.length - lowStock - outOfStock,
      lowStock,
      outOfStock,
    };
  }, [products]);

  /* ---- Pagination helpers ---- */

  function getPageNumbers(): (number | '...')[] {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('...');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  /* ---- Render ---- */

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Inventory', 'ကုန်ပစ္စည်းစာရင်း')}</h1>
          <p className="page-subtitle mm-text">{t('Stock Management', 'ကုန်လက်ကျန်စီမံခန့်ခွဲမှု')}</p>
        </div>
      </div>

      <div className="page-body">
        {/* Summary Cards */}
        <div
          className="flex gap-md"
          style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}
        >
          <div
            style={{
              flex: '1 1 150px',
              padding: 'var(--space-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
            onClick={() => { setStockFilter('all'); handleTabChange('levels'); }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
              {t('Total Products', 'စုစုပေါင်းကုန်ပစ္စည်း')}
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700 }}>
              {stockSummary.total}
            </div>
          </div>
          <div
            style={{
              flex: '1 1 150px',
              padding: 'var(--space-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
            onClick={() => { setStockFilter('all'); handleTabChange('levels'); }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
              {t('In Stock', 'ကုန်လက်ကျန်ရှိ')}
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--success)' }}>
              {stockSummary.inStock}
            </div>
          </div>
          <div
            style={{
              flex: '1 1 150px',
              padding: 'var(--space-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
            onClick={() => { setStockFilter('low'); handleTabChange('levels'); }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
              {t('Low Stock', 'ကုန်လက်ကျန်နည်း')}
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--warning)' }}>
              {stockSummary.lowStock}
            </div>
          </div>
          <div
            style={{
              flex: '1 1 150px',
              padding: 'var(--space-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
            }}
            onClick={() => { setStockFilter('out'); handleTabChange('levels'); }}
          >
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
              {t('Out of Stock', 'ကုန်ပစ္စည်းကုန်')}
            </div>
            <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--danger)' }}>
              {stockSummary.outOfStock}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-sm"
          style={{ marginBottom: 'var(--space-lg)', borderBottom: '1px solid var(--border-color)', paddingBottom: 0 }}
        >
          <button
            className={`btn btn-ghost`}
            style={{
              borderBottom: activeTab === 'levels' ? '2px solid var(--primary)' : '2px solid transparent',
              borderRadius: 0,
              color: activeTab === 'levels' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'levels' ? 700 : 400,
              paddingBottom: 'var(--space-sm)',
            }}
            onClick={() => handleTabChange('levels')}
          >
            📊 {t('Stock Levels', 'ကုန်လက်ကျန်အဆင့်')}
          </button>
          <button
            className={`btn btn-ghost`}
            style={{
              borderBottom: activeTab === 'movements' ? '2px solid var(--primary)' : '2px solid transparent',
              borderRadius: 0,
              color: activeTab === 'movements' ? 'var(--primary)' : 'var(--text-muted)',
              fontWeight: activeTab === 'movements' ? 700 : 400,
              paddingBottom: 'var(--space-sm)',
            }}
            onClick={() => handleTabChange('movements')}
          >
            📋 {t('Stock Movements', 'ကုန်ပစ္စည်းအဝင်အထွက်')}
          </button>
        </div>

        {/* Stock Levels Tab */}
        {activeTab === 'levels' && (
          <>
            {/* Filters */}
            <div
              className="flex gap-md"
              style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'center' }}
            >
              <div style={{ minWidth: 200 }}>
                <select
                  className="input"
                  value={stockFilter}
                  onChange={(e) => {
                    setStockFilter(e.target.value as 'all' | 'low' | 'out');
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">{t('All Products', 'ကုန်ပစ္စည်းအားလုံး')}</option>
                  <option value="low">⚠️ {t('Low Stock Only', 'ကုန်လက်ကျန်နည်းသည်များသာ')}</option>
                  <option value="out">🚫 {t('Out of Stock Only', 'ကုန်ပစ္စည်းကုန်သည်များသာ')}</option>
                </select>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                {filteredProducts.length} {t('product', 'ခု')}{language !== 'mm' && filteredProducts.length !== 1 ? 's' : ''}
              </div>
            </div>

            {filteredProducts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📦</div>
                <div className="empty-state-title">{t('No products found', 'ကုန်ပစ္စည်းမတွေ့ပါ')}</div>
                <div className="empty-state-text">
                  {stockFilter !== 'all'
                    ? t('No products match the selected filter', 'ရွေးချယ်ထားသောစစ်ထုတ်မှုနှင့် ကိုက်ညီသောကုန်ပစ္စည်းမရှိပါ')
                    : t('Add products to track their inventory', 'ကုန်ပစ္စည်းစာရင်းချိန်ထိန်ရန် ကုန်ပစ္စည်းများထည့်ပါ')}
                </div>
              </div>
            ) : (
              <>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                        <th>{t('SKU', 'SKU')}</th>
                        <th>{t('Category', 'အမျိုးအစား')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Current Stock', 'လက်ရှိကုန်လက်ကျန်')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Low Threshold', 'ကုန်နည်းအဆင့်')}</th>
                        <th>{t('Unit', 'ယူနစ်')}</th>
                        <th>{t('Status', 'အခြေအနေ')}</th>
                        <th style={{ width: 120 }}>{t('Actions', 'လုပ်ဆောင်ချက်')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(paginatedData as InventoryProduct[]).map((product) => {
                        const status = getStockStatus(product);

                        return (
                          <tr key={product.id}>
                            <td>
                              <div>
                                <div style={{ fontWeight: 600, marginBottom: 2 }}>
                                  {product.name}
                                </div>
                                {product.nameMm && (
                                  <div
                                    className="mm-text"
                                    style={{
                                      fontSize: 'var(--text-xs)',
                                      color: 'var(--text-muted)',
                                    }}
                                  >
                                    {product.nameMm}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              <code
                                style={{
                                  fontSize: 'var(--text-xs)',
                                  fontFamily: 'var(--font-mono)',
                                  background: 'var(--bg-tertiary)',
                                  padding: '2px 6px',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                {product.sku}
                              </code>
                            </td>
                            <td>
                              <span className="badge badge-primary">
                                {product.category?.name || '—'}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <span
                                style={{
                                  fontWeight: 700,
                                  fontSize: 'var(--text-base)',
                                  fontFamily: 'var(--font-mono)',
                                  color:
                                    product.stockQuantity <= 0
                                      ? 'var(--danger)'
                                      : product.stockQuantity <= product.lowStockThreshold
                                      ? 'var(--warning)'
                                      : 'var(--success)',
                                }}
                              >
                                {product.stockQuantity}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                              {product.lowStockThreshold}
                            </td>
                            <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                              {product.unit}
                            </td>
                            <td>
                              <span className={`badge ${status.className}`}>
                                {status.label}
                              </span>
                            </td>
                            <td>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => openAdjustModal(product)}
                              >
                                ⚙️ {t('Adjust', 'ချိန်ညှိရန်')}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="pagination-btn"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage(safePage - 1)}
                    >
                      ‹
                    </button>
                    {getPageNumbers().map((p, i) =>
                      p === '...' ? (
                        <span
                          key={`dots-${i}`}
                          style={{
                            padding: '0 4px',
                            color: 'var(--text-muted)',
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          className={`pagination-btn ${safePage === p ? 'active' : ''}`}
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      className="pagination-btn"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage(safePage + 1)}
                    >
                      ›
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Stock Movements Tab */}
        {activeTab === 'movements' && (
          <>
            {/* Filters */}
            <div
              className="flex gap-md"
              style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'flex-end' }}
            >
              <div style={{ minWidth: 180 }}>
                <select
                  className="input"
                  value={movementTypeFilter}
                  onChange={(e) => {
                    setMovementTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="">{t('All Types', 'အမျိုးအစားအားလုံး')}</option>
                  {STOCK_MOVEMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.icon} {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group" style={{ flex: '0 0 auto', margin: 0 }}>
                <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>{t('From', 'မှ')}</label>
                <input
                  type="date"
                  className="input"
                  value={movementDateFrom}
                  onChange={(e) => {
                    setMovementDateFrom(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ width: 160 }}
                />
              </div>
              <div className="input-group" style={{ flex: '0 0 auto', margin: 0 }}>
                <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>{t('To', 'ထိ')}</label>
                <input
                  type="date"
                  className="input"
                  value={movementDateTo}
                  onChange={(e) => {
                    setMovementDateTo(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ width: 160 }}
                />
              </div>
              {(movementTypeFilter || movementDateFrom || movementDateTo) && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setMovementTypeFilter('');
                    setMovementDateFrom('');
                    setMovementDateTo('');
                    setCurrentPage(1);
                  }}
                >
                  ✕ {t('Clear', 'ရှင်းလင်းရန်')}
                </button>
              )}
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                {filteredMovements.length} {t('movement', 'အဝင်အထွက်')}{language !== 'mm' && filteredMovements.length !== 1 ? 's' : ''}
              </div>
            </div>

            {filteredMovements.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">{t('No stock movements found', 'ကုန်ပစ္စည်းအဝင်အထွက်မတွေ့ပါ')}</div>
                <div className="empty-state-text">
                  {t('Stock movements will appear here when stock is adjusted', 'ကုန်လက်ကျန်ချိန်ညှိသည့်အခါ ဤနေရာတွင်ပြပါမည်')}
                </div>
              </div>
            ) : (
              <>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('Date', 'ရက်စွဲ')}</th>
                        <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                        <th>{t('Type', 'အမျိုးအစား')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Quantity', 'အရေအတွက်')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Previous', 'ယခင်')}</th>
                        <th style={{ textAlign: 'right' }}>{t('New Stock', 'အသစ်ကုန်လက်ကျန်')}</th>
                        <th>{t('Reason', 'အကြောင်းပြချက်')}</th>
                        <th>{t('User', 'အသုံးပြုသူ')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(paginatedData as StockMovementData[]).map((movement) => {
                        const typeBadge = getMovementTypeBadge(movement.type);
                        const isIncrease = movement.type === 'IN' || movement.type === 'RETURN';

                        return (
                          <tr key={movement.id}>
                            <td style={{ fontSize: 'var(--text-sm)' }}>
                              {formatDateTime(movement.createdAt)}
                            </td>
                            <td>
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                                  {movement.product?.name || '—'}
                                </div>
                                {movement.product?.sku && (
                                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                    {movement.product.sku}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              <span className={`badge ${typeBadge.className}`}>
                                {typeBadge.icon} {typeBadge.label}
                              </span>
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontWeight: 700,
                                fontFamily: 'var(--font-mono)',
                                color: movement.type === 'ADJUSTMENT'
                                  ? 'var(--warning)'
                                  : isIncrease
                                  ? 'var(--success)'
                                  : 'var(--danger)',
                              }}
                            >
                              {movement.type === 'ADJUSTMENT'
                                ? `→ ${movement.quantity}`
                                : isIncrease
                                ? `+${movement.quantity}`
                                : `-${movement.quantity}`}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                              {movement.previousStock}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                              {movement.newStock}
                            </td>
                            <td style={{ fontSize: 'var(--text-sm)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {movement.reason || (
                                <span style={{ color: 'var(--text-muted)' }}>—</span>
                              )}
                            </td>
                            <td style={{ fontSize: 'var(--text-sm)' }}>
                              {movement.user?.name || '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="pagination">
                    <button
                      className="pagination-btn"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage(safePage - 1)}
                    >
                      ‹
                    </button>
                    {getPageNumbers().map((p, i) =>
                      p === '...' ? (
                        <span
                          key={`dots-${i}`}
                          style={{
                            padding: '0 4px',
                            color: 'var(--text-muted)',
                            fontSize: 'var(--text-sm)',
                          }}
                        >
                          …
                        </span>
                      ) : (
                        <button
                          key={p}
                          className={`pagination-btn ${safePage === p ? 'active' : ''}`}
                          onClick={() => setCurrentPage(p)}
                        >
                          {p}
                        </button>
                      )
                    )}
                    <button
                      className="pagination-btn"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage(safePage + 1)}
                    >
                      ›
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {adjustTarget && (
        <div className="modal-backdrop" onClick={closeAdjustModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500 }}
          >
            <div className="modal-header">
              <h2 className="modal-title">{t('Adjust Stock', 'ကုန်လက်ကျန်ချိန်ညှိရန်')}</h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={closeAdjustModal}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* Product Info */}
              <div
                style={{
                  padding: 'var(--space-md)',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-lg)',
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {adjustTarget.name}
                </div>
                {adjustTarget.nameMm && (
                  <div className="mm-text" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
                    {adjustTarget.nameMm}
                  </div>
                )}
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  SKU: {adjustTarget.sku} • {t('Current Stock', 'လက်ရှိကုန်လက်ကျန်')}:{' '}
                  <strong
                    style={{
                      color:
                        adjustTarget.stockQuantity <= 0
                          ? 'var(--danger)'
                          : adjustTarget.stockQuantity <= adjustTarget.lowStockThreshold
                          ? 'var(--warning)'
                          : 'var(--success)',
                    }}
                  >
                    {adjustTarget.stockQuantity}
                  </strong>{' '}
                  {adjustTarget.unit}
                </div>
              </div>

              {/* Movement Type */}
              <div className="input-group">
                <label className="input-label">{t('Movement Type *', 'အဝင်အထွက်အမျိုးအစား *')}</label>
                <select
                  className="input"
                  value={adjustForm.type}
                  onChange={(e) =>
                    handleAdjustFormChange('type', e.target.value)
                  }
                >
                  <option value="IN">📥 {t('Stock In — Add to current stock', 'ကုန်ပစ္စည်းအဝင် — လက်ရှိကုန်လက်ကျန်သို့ထည့်ရန်')}</option>
                  <option value="OUT">📤 {t('Stock Out — Remove from current stock', 'ကုန်ပစ္စည်းအထွက် — လက်ရှိကုန်လက်ကျန်မှနှုတ်ရန်')}</option>
                  <option value="ADJUSTMENT">🔄 {t('Adjustment — Set exact quantity', 'ချိန်ညှိမှု — အတိအကျပမာဏသတ်မှတ်ရန်')}</option>
                </select>
              </div>

              {/* Quantity */}
              <div className="input-group">
                <label className="input-label">
                  {adjustForm.type === 'ADJUSTMENT'
                    ? t('New Stock Quantity *', 'အသစ်ကုန်လက်ကျန် *')
                    : t('Quantity *', 'အရေအတွက် *')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  className={`input ${adjustErrors.quantity ? 'input-error' : ''}`}
                  placeholder={
                    adjustForm.type === 'ADJUSTMENT'
                      ? t('Enter exact stock count', 'အတိအကျကုန်လက်ကျန်ထည့်ပါ')
                      : t('Enter quantity', 'အရေအတွက်ထည့်ပါ')
                  }
                  value={adjustForm.quantity}
                  onChange={(e) =>
                    handleAdjustFormChange('quantity', e.target.value)
                  }
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                {adjustErrors.quantity && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {adjustErrors.quantity}
                  </span>
                )}
                {adjustForm.quantity && !adjustErrors.quantity && (
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                      marginTop: 4,
                    }}
                  >
                    {adjustForm.type === 'IN' && (
                      <>{t('New stock will be', 'အသစ်ကုန်လက်ကျန်')}: {adjustTarget.stockQuantity + Number(adjustForm.quantity)} {adjustTarget.unit}</>
                    )}
                    {adjustForm.type === 'OUT' && (
                      <>{t('New stock will be', 'အသစ်ကုန်လက်ကျန်')}: {adjustTarget.stockQuantity - Number(adjustForm.quantity)} {adjustTarget.unit}</>
                    )}
                    {adjustForm.type === 'ADJUSTMENT' && (
                      <>{t('Stock will be set to', 'ကုန်လက်ကျန်သတ်မှတ်မည်')}: {Number(adjustForm.quantity)} {adjustTarget.unit}</>
                    )}
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="input-group">
                <label className="input-label">{t('Reason *', 'အကြောင်းပြချက် *')}</label>
                <textarea
                  className={`input ${adjustErrors.reason ? 'input-error' : ''}`}
                  rows={3}
                  placeholder={t('e.g. New shipment received, Physical count correction, etc.', 'ဥပမာ - ကုန်ပစ္စည်းအသစ်ရရှိ၊ ကုန်လက်ကျန်သပ်မှတ်ရင်းပြင်ရန် စသည်း')}
                  value={adjustForm.reason}
                  onChange={(e) =>
                    handleAdjustFormChange('reason', e.target.value)
                  }
                  style={{ resize: 'vertical' }}
                />
                {adjustErrors.reason && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {adjustErrors.reason}
                  </span>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={closeAdjustModal}
                disabled={saving}
              >
                {t('Cancel', 'မလုပ်တော့ပါ')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleAdjustSubmit}
                disabled={saving}
              >
                {saving ? t('Saving...', 'သိမ်းနေသည်...') : t('Adjust Stock', 'ကုန်လက်ကျန်ချိန်ညှိရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
