'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { PAYMENT_METHODS, SALE_STATUSES } from '@/lib/constants';

const paymentMethodTranslationKeys: Record<string, string> = {
  CASH: 'cash',
  CARD: 'card',
  MOBILE_BANKING: 'mobileBanking',
  CREDIT: 'credit',
};

const saleStatusTranslationKeys: Record<string, string> = {
  COMPLETED: 'completed',
  REFUNDED: 'refunded',
  VOIDED: 'voided',
};

/* ---------- Types ---------- */

interface SaleProduct {
  id?: string;
  name: string;
  nameMm: string | null;
  sku: string;
}

interface SaleItemData {
  id: string;
  saleId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  product?: SaleProduct;
}

interface SaleCustomer {
  id: string;
  name: string;
  phone: string | null;
}

interface SaleUser {
  id: string;
  name: string;
}

interface Sale {
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
  paymentMethod: string;
  status: string;
  notes: string | null;
  createdAt: string | Date;
  customer?: SaleCustomer | null;
  user?: SaleUser;
  items?: SaleItemData[];
}

/* ---------- Constants ---------- */

const ITEMS_PER_PAGE = 15;

/* ---------- Component ---------- */

interface SalesClientProps {
  initialSales: Sale[];
}

export function SalesClient({ initialSales }: SalesClientProps) {
  const { addToast } = useToast();
  const { language, t } = useI18n();

  // State
  const [sales, setSales] = useState<Sale[]>(initialSales);
  // Sync when server re-renders with fresh data
  useEffect(() => { setSales(initialSales); }, [initialSales]);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [voidTarget, setVoidTarget] = useState<Sale | null>(null);
  const [voidAction, setVoidAction] = useState<'VOIDED' | 'REFUNDED'>('VOIDED');
  const [voidReason, setVoidReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Filtered sales
  const filteredSales = useMemo(() => {
    let result = sales;

    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((s) => new Date(s.createdAt) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((s) => new Date(s.createdAt) <= to);
    }

    if (paymentFilter) {
      result = result.filter((s) => s.paymentMethod === paymentFilter);
    }

    if (statusFilter) {
      result = result.filter((s) => s.status === statusFilter);
    }

    return result;
  }, [sales, dateFrom, dateTo, paymentFilter, statusFilter]);

  // Summary
  const summary = useMemo(() => {
    const completed = filteredSales.filter((s) => s.status === 'COMPLETED');
    return {
      totalCount: filteredSales.length,
      completedCount: completed.length,
      totalRevenue: completed.reduce((sum, s) => sum + s.totalAmount, 0),
    };
  }, [filteredSales]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSales = filteredSales.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const handleFilterChange = useCallback(() => {
    setCurrentPage(1);
  }, []);

  function setDateFromValue(val: string) {
    setDateFrom(val);
    handleFilterChange();
  }

  function setDateToValue(val: string) {
    setDateTo(val);
    handleFilterChange();
  }

  function setPaymentFilterValue(val: string) {
    setPaymentFilter(val);
    handleFilterChange();
  }

  function setStatusFilterValue(val: string) {
    setStatusFilter(val);
    handleFilterChange();
  }

  // Void/Refund
  async function handleVoidRefund() {
    if (!voidTarget) return;
    const reason = voidReason.trim();
    if (!reason) {
      addToast(t('reasonRequired'), 'error');
      return;
    }
    setProcessing(true);

    try {
      const res = await fetch(`/api/sales/${voidTarget.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: voidAction, reason }),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || t('Failed to update sale', 'အရောင်းအခြေအနေပြောင်းမရပါ'), 'error');
        return;
      }

      setSales((prev) =>
        prev.map((s) => (s.id === voidTarget.id ? data : s))
      );
      addToast(
        voidAction === 'VOIDED'
          ? t('Sale voided successfully', 'အရောင်းပယ်ဖျက်ပြီးပါပြီ')
          : t('Sale refunded successfully', 'အရောင်းပြန်အမ်းပြီးပါပြီ'),
        'success'
      );
      setVoidTarget(null);
      setVoidReason('');
      setSelectedSale(null);
    } catch {
      addToast(t('Network error. Please try again.', 'ကွန်ရက်ချို့ယွင်းချက်။ ထပ်ကြိုးစားပါ။'), 'error');
    } finally {
      setProcessing(false);
    }
  }

  // Payment method helpers
  function getPaymentBadge(method: string): string {
    const found = PAYMENT_METHODS.find((p) => p.value === method);
    return found ? `${found.icon} ${t(paymentMethodTranslationKeys[method] ?? method)}` : method;
  }

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'COMPLETED':
        return 'badge-success';
      case 'REFUNDED':
        return 'badge-warning';
      case 'VOIDED':
        return 'badge-danger';
      default:
        return 'badge-neutral';
    }
  }

  function getStatusLabel(status: string): string {
    return SALE_STATUSES.some((s) => s.value === status)
      ? t(saleStatusTranslationKeys[status] ?? status)
      : status;
  }

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
          <h1 className="page-title">{t('Sales History', 'ရောင်းချမှတ်တမ်း')}</h1>
          <p className="page-subtitle mm-text">{t('Transaction Records', 'ငွေသွင်းငွေထုတ်မှတ်တမ်းများ')}</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={() => addToast('Export feature coming soon', 'info')}
          >
            📥 {t('Export', 'ထုတ်ရန်')}
          </button>
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
              flex: '1 1 200px',
              padding: 'var(--space-lg)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
              {t('totalSales')}
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {summary.totalCount}
            </div>
          </div>
          <div
            style={{
              flex: '1 1 200px',
              padding: 'var(--space-lg)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
              {t('Completed', 'ပြီးမြောက်')}
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--success)' }}>
              {summary.completedCount}
            </div>
          </div>
          <div
            style={{
              flex: '1 1 200px',
              padding: 'var(--space-lg)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
              {t('Total Revenue', 'စုစုပေါင်းဝင်ငွေ')}
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--primary)' }}>
              {formatCurrency(summary.totalRevenue)}
            </div>
          </div>
        </div>

        {/* Filters Bar */}
        <div
          className="flex gap-md"
          style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <div className="input-group" style={{ flex: '0 0 auto', margin: 0 }}>
            <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>{t('From', 'မှ')}</label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              onChange={(e) => setDateFromValue(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
          <div className="input-group" style={{ flex: '0 0 auto', margin: 0 }}>
            <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>{t('To', 'ထိ')}</label>
            <input
              type="date"
              className="input"
              value={dateTo}
              onChange={(e) => setDateToValue(e.target.value)}
              style={{ width: 160 }}
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <select
              className="input"
              value={paymentFilter}
              onChange={(e) => setPaymentFilterValue(e.target.value)}
            >
              <option value="">{t('All Payments', 'ငွေပေးချေမှုအားလုံး')}</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.value} value={pm.value}>
                  {pm.icon} {t(paymentMethodTranslationKeys[pm.value] ?? pm.value)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 160 }}>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => setStatusFilterValue(e.target.value)}
            >
              <option value="">{t('All Status', 'အခြေအနေအားလုံး')}</option>
              {SALE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {t(saleStatusTranslationKeys[s.value] ?? s.value)}
                </option>
              ))}
            </select>
          </div>
          {(dateFrom || dateTo || paymentFilter || statusFilter) && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setPaymentFilter('');
                setStatusFilter('');
                setCurrentPage(1);
              }}
            >
              ✕ {t('Clear Filters', 'စစ်ထုတ်မှုရှင်းရန်')}
            </button>
          )}
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {filteredSales.length} {t('sale', 'ခု')}{language !== 'mm' && filteredSales.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Sales Table */}
        {filteredSales.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💰</div>
            <div className="empty-state-title">{t('No sales found', 'အရောင်းမတွေ့ပါ')}</div>
            <div className="empty-state-text">
              {dateFrom || dateTo || paymentFilter || statusFilter
                ? t('Try adjusting your filter criteria', 'စစ်ထုတ်မှုကို ပြန်ပြင်ကြည့်ပါ')
                : t('Sales will appear here after transactions are completed', 'အရောင်းပြီးမြောက်ပါက ဤနေရာတွင်ပေါ်ပါမည်')}
            </div>
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('invoiceNumber')}</th>
                    <th>{t('Date & Time', 'ရက်စွဲနှင့်အချိန်')}</th>
                    <th>{t('customer')}</th>
                    <th style={{ textAlign: 'center' }}>{t('items')}</th>
                    <th style={{ textAlign: 'right' }}>{t('subtotal')}</th>
                    <th style={{ textAlign: 'right' }}>{t('discount')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
                    <th>{t('payment')}</th>
                    <th>{t('Status', 'အခြေအနေ')}</th>
                    <th style={{ width: 80 }}>{t('Actions', 'လုပ်ဆောင်ချက်')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedSales.map((sale) => (
                    <tr
                      key={sale.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setSelectedSale(sale)}
                    >
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
                          {sale.invoiceNumber}
                        </code>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>
                        {formatDateTime(sale.createdAt)}
                      </td>
                      <td>
                        {sale.customer ? (
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                              {sale.customer.name}
                            </div>
                            {sale.customer.phone && (
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                {sale.customer.phone}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                            {t('walkIn')}
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                        {sale.items?.length || 0}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                        {formatCurrency(sale.subtotal)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                        {sale.discountAmount > 0 ? (
                          <span style={{ color: 'var(--danger)' }}>
                            -{formatCurrency(sale.discountAmount)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          color: 'var(--primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-sm)',
                        }}
                      >
                        {formatCurrency(sale.totalAmount)}
                      </td>
                      <td>
                        <span className="badge badge-primary" style={{ fontSize: 'var(--text-xs)' }}>
                          {getPaymentBadge(sale.paymentMethod)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getStatusBadgeClass(sale.status)}`}>
                          {getStatusLabel(sale.status)}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSale(sale);
                            }}
                            title={t('View details', 'အသေးစိတ်ကြည့်ရန်')}
                          >
                            👁️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
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
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="modal-backdrop" onClick={() => setSelectedSale(null)}>
          <div
            className="modal modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {t('Sale Details', 'အရောင်းအသေးစိတ်')} — {selectedSale.invoiceNumber}
              </h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setSelectedSale(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* Sale Info */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-md)',
                  marginBottom: 'var(--space-lg)',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('Date & Time', 'ရက်စွဲနှင့်အချိန်')}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {formatDateTime(selectedSale.createdAt)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('customer')}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {selectedSale.customer?.name || t('walkIn')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('cashier')}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {selectedSale.user?.name || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('Status', 'အခြေအနေ')}
                  </div>
                  <span className={`badge ${getStatusBadgeClass(selectedSale.status)}`}>
                    {getStatusLabel(selectedSale.status)}
                  </span>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginBottom: 'var(--space-lg)' }}>
                <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
                  {t('items')}
                </h3>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                        <th style={{ textAlign: 'center' }}>{t('Qty', 'အရေအတွက်')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Unit Price', 'တစ်ခုဈေး')}</th>
                        <th style={{ textAlign: 'right' }}>{t('discount')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSale.items?.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                              {item.product?.name || 'Unknown Product'}
                            </div>
                            {item.product?.sku && (
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                                {item.product.sku}
                              </div>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                            {item.quantity}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                            {item.discount > 0 ? (
                              <span style={{ color: 'var(--danger)' }}>
                                -{formatCurrency(item.discount)}
                              </span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                            {formatCurrency(item.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Payment Summary */}
              <div
                style={{
                  padding: 'var(--space-md)',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: 'var(--space-xs)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>{t('subtotal')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(selectedSale.subtotal)}</span>
                </div>
                {selectedSale.discountAmount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--space-xs)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <span style={{ color: 'var(--danger)' }}>{t('discount')}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>
                      -{formatCurrency(selectedSale.discountAmount)}
                    </span>
                  </div>
                )}
                {selectedSale.taxAmount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 'var(--space-xs)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{t('Tax', 'အခွန်')}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(selectedSale.taxAmount)}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    paddingTop: 'var(--space-sm)',
                    borderTop: '1px solid var(--border-color)',
                    fontWeight: 700,
                    fontSize: 'var(--text-base)',
                  }}
                >
                  <span>{t('Total', 'စုစုပေါင်း')}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                    {formatCurrency(selectedSale.totalAmount)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: 'var(--space-sm)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>
                    {t('payment')}: {getPaymentBadge(selectedSale.paymentMethod)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>
                    {t('Paid', 'ပေးငွေ')}: {formatCurrency(selectedSale.paidAmount)}
                  </span>
                </div>
                {selectedSale.changeAmount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    <span style={{ color: 'var(--text-muted)' }}>{t('Change', 'ပြန်အမ်းငွေ')}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(selectedSale.changeAmount)}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              {selectedSale.notes && (
                <div style={{ marginTop: 'var(--space-md)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  <strong>{t('notes')}:</strong> {selectedSale.notes}
                </div>
              )}
            </div>
            <div className="modal-footer">
              {selectedSale.status === 'COMPLETED' && (
                <>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      setVoidTarget(selectedSale);
                      setVoidAction('VOIDED');
                      setVoidReason('');
                    }}
                  >
                    🚫 {t('Void Sale', 'အရောင်းပယ်ဖျက်ရန်')}
                  </button>
                  <button
                    className="btn btn-warning"
                    onClick={() => {
                      setVoidTarget(selectedSale);
                      setVoidAction('REFUNDED');
                      setVoidReason('');
                    }}
                  >
                    ↩️ {t('Refund', 'ပြန်အမ်းရန်')}
                  </button>
                </>
              )}
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedSale(null)}
              >
                {t('Close', 'ပိတ်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Void/Refund Confirmation Modal */}
      {voidTarget && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setVoidTarget(null);
            setVoidReason('');
          }}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440 }}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {voidAction === 'VOIDED' ? t('Void Sale', 'အရောင်းပယ်ဖျက်ရန်') : t('Refund Sale', 'အရောင်းပြန်အမ်းရန်')}
              </h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => {
                  setVoidTarget(null);
                  setVoidReason('');
                }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-secondary)',
                  lineHeight: 1.6,
                }}
              >
                {t('Are you sure you want to', 'သေချာပါသလား')}{' '}
                {voidAction === 'VOIDED' ? t('void', 'ပယ်ဖျက်') : t('refund', 'ပြန်အမ်း')} {t('sale', 'အရောင်း')}{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {voidTarget.invoiceNumber}
                </strong>{' '}
                for{' '}
                <strong style={{ color: 'var(--primary)' }}>
                  {formatCurrency(voidTarget.totalAmount)}
                </strong>
                ?
              </p>
              <div
                style={{
                  marginTop: 'var(--space-md)',
                  padding: 'var(--space-md)',
                  background: 'var(--warning-light)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--warning)',
                }}
              >
                ⚠ {t('This action will restore stock quantities for all items in this sale.', 'ဤလုပ်ဆောင်ချက်သည် ဤအရောင်းရှိပစ္စည်းများ၏ ကုန်လက်ကျန်ကို ပြန်လည်ထည့်ပေးပါမည်။')}
              </div>
              <div className="input-group" style={{ marginTop: 'var(--space-md)' }}>
                <label className="input-label">
                  {t('reasonLabel')} *
                </label>
                <textarea
                  className="input"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder={t('enterReason')}
                  rows={3}
                  maxLength={500}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setVoidTarget(null);
                  setVoidReason('');
                }}
                disabled={processing}
              >
                {t('Cancel', 'မလုပ်တော့ပါ')}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleVoidRefund}
                disabled={processing || !voidReason.trim()}
              >
                {processing
                  ? t('Processing...', 'ဆောင်ရွက်နေသည်...')
                  : voidAction === 'VOIDED'
                  ? t('Void Sale', 'အရောင်းပယ်ဖျက်ရန်')
                  : t('Refund Sale', 'အရောင်းပြန်အမ်းရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
