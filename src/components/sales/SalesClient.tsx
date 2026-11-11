'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDateTime, parseMyanmarDateBoundary } from '@/lib/utils';
import { PAYMENT_METHODS, SALE_STATUSES } from '@/lib/constants';
import {
  SaleRecord,
  buildReceiptDataFromSale,
  downloadSalesCsv,
  getPaymentMethodLabel,
  getSaleStatusBadgeClass,
  getSaleStatusLabel,
} from '@/lib/saleHelpers';
import {
  PaymentMethodIcon,
  Download,
  Receipt as ReceiptIcon,
  Eye,
  Printer,
  X,
} from '@/components/ui/Icons';
import Receipt from '@/components/pos/Receipt';
import { SaleRefundModal, SaleRefundAction } from '@/components/sales/SaleRefundModal';
import { SaleQuickViewModal } from '@/components/sales/SaleQuickViewModal';

const ITEMS_PER_PAGE = 15;

interface SalesClientProps {
  initialSales: SaleRecord[];
}

export function SalesClient({ initialSales }: SalesClientProps) {
  const { addToast } = useToast();
  const { language, t } = useI18n();

  const [sales, setSales] = useState<SaleRecord[]>(initialSales);
  useEffect(() => {
    setSales(initialSales);
  }, [initialSales]);

  const [currentPage, setCurrentPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleRecord | null>(null);
  const [printTargetSale, setPrintTargetSale] = useState<SaleRecord | null>(null);
  const [voidTarget, setVoidTarget] = useState<SaleRecord | null>(null);
  const [voidAction, setVoidAction] = useState<SaleRefundAction>('VOIDED');

  const filteredSales = useMemo(() => {
    let result = sales;

    if (dateFrom) {
      const from = parseMyanmarDateBoundary(dateFrom, false);
      if (from) result = result.filter((s) => new Date(s.createdAt) >= from);
    }

    if (dateTo) {
      const to = parseMyanmarDateBoundary(dateTo, true);
      if (to) result = result.filter((s) => new Date(s.createdAt) <= to);
    }

    if (paymentFilter) {
      result = result.filter((s) => s.paymentMethod === paymentFilter);
    }

    if (statusFilter) {
      result = result.filter((s) => s.status === statusFilter);
    }

    return result;
  }, [sales, dateFrom, dateTo, paymentFilter, statusFilter]);

  const summary = useMemo(() => {
    const completed = filteredSales.filter(
      (s) => s.status === 'COMPLETED' || s.status === 'PARTIALLY_REFUNDED'
    );
    return {
      totalCount: filteredSales.length,
      completedCount: completed.length,
      totalRevenue: completed.reduce((sum, s) => sum + s.totalAmount, 0),
    };
  }, [filteredSales]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedSales = filteredSales.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const handleFilterChange = useCallback(() => {
    setCurrentPage(1);
  }, []);

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

  function handleExportSalesCsv() {
    if (filteredSales.length === 0) {
      addToast(t('No sales to export', 'ထုတ်ယူရန် အရောင်းမှတ်တမ်း မရှိပါ'), 'warning');
      return;
    }
    downloadSalesCsv(filteredSales);
    addToast(t('Sales exported to CSV', 'အရောင်းစာရင်း CSV ထုတ်ယူပြီးပါပြီ'), 'success');
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Sales History', 'ရောင်းချမှတ်တမ်း')}</h1>
          <p className="page-subtitle mm-text">
            {t('Transaction Records', 'ငွေသွင်းငွေထုတ်မှတ်တမ်းများ')}
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={handleExportSalesCsv}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={15} strokeWidth={1.75} />
            {t('Export CSV', 'CSV ထုတ်ရန်')}
          </button>
        </div>
      </div>

      <div className="page-body">
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

        <div
          className="flex gap-md"
          style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <div className="input-group" style={{ flex: '0 0 auto', margin: 0 }}>
            <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>
              {t('From', 'မှ')}
            </label>
            <input
              type="date"
              className="input"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                handleFilterChange();
              }}
              style={{ width: 160 }}
            />
          </div>
          <div className="input-group" style={{ flex: '0 0 auto', margin: 0 }}>
            <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>
              {t('To', 'ထိ')}
            </label>
            <input
              type="date"
              className="input"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                handleFilterChange();
              }}
              style={{ width: 160 }}
            />
          </div>
          <div style={{ minWidth: 180 }}>
            <select
              className="input"
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                handleFilterChange();
              }}
            >
              <option value="">{t('All Payments', 'ငွေပေးချေမှုအားလုံး')}</option>
              {PAYMENT_METHODS.map((pm) => (
                <option key={pm.value} value={pm.value}>
                  {getPaymentMethodLabel(pm.value, t)}
                </option>
              ))}
            </select>
          </div>
          <div style={{ minWidth: 160 }}>
            <select
              className="input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                handleFilterChange();
              }}
            >
              <option value="">{t('All Status', 'အခြေအနေအားလုံး')}</option>
              {SALE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {getSaleStatusLabel(s.value, t)}
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
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <X size={13} strokeWidth={1.75} />
              {t('Clear Filters', 'စစ်ထုတ်မှုရှင်းရန်')}
            </button>
          )}
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {filteredSales.length} {t('sale', 'ခု')}
            {language !== 'mm' && filteredSales.length !== 1 ? 's' : ''}
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ReceiptIcon size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-title">{t('No sales found', 'အရောင်းမတွေ့ပါ')}</div>
            <div className="empty-state-text">
              {dateFrom || dateTo || paymentFilter || statusFilter
                ? t('Try adjusting your filter criteria', 'စစ်ထုတ်မှုကို ပြန်ပြင်ကြည့်ပါ')
                : t(
                    'Sales will appear here after transactions are completed',
                    'အရောင်းပြီးမြောက်ပါက ဤနေရာတွင်ပေါ်ပါမည်'
                  )}
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
                        <span
                          className="badge badge-primary"
                          style={{
                            fontSize: 'var(--text-xs)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <PaymentMethodIcon method={sale.paymentMethod} size={13} />
                          {getPaymentMethodLabel(sale.paymentMethod, t)}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${getSaleStatusBadgeClass(sale.status)}`}>
                          {getSaleStatusLabel(sale.status, t)}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrintTargetSale(sale);
                            }}
                            title={t('Print Receipt', 'ဘောင်ချာ ပရင့်ထုတ်ရန်')}
                          >
                            <Printer size={15} strokeWidth={1.75} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSale(sale);
                            }}
                            title={t('View details', 'အသေးစိတ်ကြည့်ရန်')}
                          >
                            <Eye size={15} strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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

      <SaleQuickViewModal
        sale={selectedSale}
        onClose={() => setSelectedSale(null)}
        onPrint={(sale) => setPrintTargetSale(sale)}
        onRequestAction={(sale, action) => {
          setVoidTarget(sale);
          setVoidAction(action);
        }}
      />

      <SaleRefundModal
        sale={voidTarget}
        actionType={voidAction}
        onClose={() => setVoidTarget(null)}
        onSuccess={(updatedSale) => {
          setSales((prev) => prev.map((s) => (s.id === updatedSale.id ? updatedSale : s)));
          setVoidTarget(null);
          setSelectedSale(null);
        }}
      />

      {printTargetSale && (
        <Receipt
          data={buildReceiptDataFromSale(printTargetSale, language)}
          onNewSale={() => setPrintTargetSale(null)}
          closeLabel={t('Close', 'ပိတ်ရန်')}
        />
      )}
    </>
  );
}
