'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatDateTime, getMyanmarDateKey } from '@/lib/utils';
import { escapeCsvCell } from '@/lib/csv';
import {
  ShieldCheck,
  Download,
  RefreshCw,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
} from '@/components/ui/Icons';
import type { AuditLogRecord } from '@/types';

const ACTION_LABELS: Record<string, { en: string; mm: string }> = {
  SALE_VOID: { en: 'Sale Voided', mm: 'အရောင်းပယ်ဖျက်ခြင်း' },
  SALE_REFUND: { en: 'Full Refund', mm: 'ဘောင်ချာအပြည့် ပြန်အမ်းခြင်း' },
  SALE_PARTIAL_REFUND: { en: 'Partial Refund', mm: 'ပစ္စည်းအချို့ ပြန်အမ်းခြင်း' },
  PRICE_OVERRIDE: { en: 'POS Price Override', mm: 'POS ဈေးနှုန်းပြင်ရောင်းခြင်း' },
  PRODUCT_PRICE_CHANGE: { en: 'Product Price Changed', mm: 'ကုန်ပစ္စည်းဈေးနှုန်း ပြောင်းလဲခြင်း' },
  STOCK_ADJUSTMENT: { en: 'Stock Adjustment', mm: 'ကုန်လက်ကျန် ချိန်ညှိခြင်း' },
  PURCHASE_ORDER_CREATED: { en: 'Purchase Order Received', mm: 'ကုန်အဝယ် လက်ခံသွင်းခြင်း' },
  PURCHASE_ORDER_CANCELLED: { en: 'Purchase Order Cancelled', mm: 'ကုန်အဝယ် ပယ်ဖျက်ခြင်း' },
  SUPPLIER_DEBT_REPAYMENT: { en: 'Supplier Debt Paid', mm: 'ပေးသွင်းသူအကြွေး ပေးချေခြင်း' },
  CUSTOMER_DEBT_REPAYMENT: { en: 'Customer Debt Received', mm: 'ဖောက်သည်အကြွေး လက်ခံခြင်း' },
  SHIFT_CLOSED: { en: 'Shift Closed', mm: 'အဆိုင်းပိတ်ခြင်း' },
  USER_CREATED: { en: 'User Account Created', mm: 'ဝန်ထမ်းအကောင့် ဖန်တီးခြင်း' },
  USER_UPDATED: { en: 'User Account Updated', mm: 'ဝန်ထမ်းအကောင့် ပြင်ဆင်ခြင်း' },
  SETTINGS_UPDATED: { en: 'Settings Updated', mm: 'ဆိုင်ဆက်တင် ပြင်ဆင်ခြင်း' },
  DATA_MIGRATION_IMPORT: { en: 'Excel Data Imported', mm: 'Excel ဒေတာ သွင်းယူခြင်း' },
  DATA_MIGRATION_EXPORT: { en: 'Excel Data Exported', mm: 'Excel ဒေတာ ထုတ်ယူခြင်း' },
  CUSTOMER_CREDIT_RECONCILED: { en: 'Customer Credit Reconciled', mm: 'ဖောက်သည်အကြွေးစာရင်း တိုက်ဆိုင်ပြင်ဆင်ခြင်း' },
  STOCKTAKE_COMPLETED: { en: 'Stocktake Completed', mm: 'ကုန်လက်ကျန်စစ်ဆေးမှု အတည်ပြုခြင်း' },
  PROMOTION_UPDATED: { en: 'Promotion Saved', mm: 'ပရိုမိုးရှင်း သိမ်းဆည်းခြင်း' },
  QUOTATION_CREATED: { en: 'Quotation Created', mm: 'ဈေးနှုန်းကမ်းလှမ်းလွှာ ဖန်တီးခြင်း' },
  EXPENSE_CREATED: { en: 'Expense Recorded', mm: 'အသုံးစရိတ် မှတ်တမ်းတင်ခြင်း' },
  EXPENSE_UPDATED: { en: 'Expense Updated', mm: 'အသုံးစရိတ် ပြင်ဆင်ခြင်း' },
  EXPENSE_DELETED: { en: 'Expense Deleted', mm: 'အသုံးစရိတ် ဖျက်ခြင်း' },
};

const ENTITY_LABELS: Record<string, { en: string; mm: string }> = {
  SALE: { en: 'Sale', mm: 'အရောင်း' },
  PRODUCT: { en: 'Product', mm: 'ကုန်ပစ္စည်း' },
  INVENTORY: { en: 'Inventory', mm: 'ကုန်လက်ကျန်' },
  CUSTOMER: { en: 'Customer', mm: 'ဖောက်သည်' },
  SUPPLIER: { en: 'Supplier', mm: 'ပေးသွင်းသူ' },
  PURCHASE_ORDER: { en: 'Purchase Order', mm: 'ကုန်အဝယ်' },
  SHIFT: { en: 'Shift', mm: 'အဆိုင်း' },
  USER: { en: 'User', mm: 'ဝန်ထမ်း' },
  SETTINGS: { en: 'Settings', mm: 'ဆက်တင်' },
  DATA_MIGRATION: { en: 'Data Migration', mm: 'ဒေတာကူးပြောင်းမှု' },
  STOCKTAKE: { en: 'Stocktake', mm: 'ကုန်လက်ကျန်စစ်ဆေးမှု' },
  PROMOTION: { en: 'Promotion', mm: 'ပရိုမိုးရှင်း' },
  QUOTATION: { en: 'Quotation', mm: 'ဈေးနှုန်းကမ်းလှမ်းလွှာ' },
  EXPENSE: { en: 'Expense', mm: 'အသုံးစရိတ်' },
};

const ACTION_OPTIONS = Object.keys(ACTION_LABELS);

function getActionBadgeClass(action: string): string {
  if (action.includes('VOID') || action.includes('CANCELLED') || action.includes('DELETED')) return 'badge-danger';
  if (action.includes('REFUND') || action.includes('OVERRIDE') || action.includes('PRICE')) {
    return 'badge-warning';
  }
  if (action.includes('PURCHASE') || action.includes('REPAYMENT') || action.includes('CREATED')) return 'badge-success';
  return 'badge-primary';
}

interface AuditLogsPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface AuditLogsClientProps {
  initialLogs: AuditLogRecord[];
  initialPagination: AuditLogsPagination;
  users: Array<{ id: string; name: string; role: string }>;
}

export function AuditLogsClient({ initialLogs, initialPagination, users }: AuditLogsClientProps) {
  const { language, t } = useI18n();
  const { addToast } = useToast();
  const tRef = useRef(t);
  tRef.current = t;

  const getActionLabel = (action: string) =>
    ACTION_LABELS[action]?.[language] ?? action;

  const getEntityLabel = (entityType: string) =>
    ENTITY_LABELS[entityType]?.[language] ?? entityType;

  const [logs, setLogs] = useState<AuditLogRecord[]>(initialLogs);
  const [pagination, setPagination] = useState<AuditLogsPagination>(initialPagination);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  const fetchLogs = useCallback(async (targetPage = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      if (actionFilter) params.set('action', actionFilter);
      if (userFilter) params.set('userId', userFilter);
      if (search.trim()) params.set('search', search.trim());
      params.set('page', String(Math.max(1, targetPage)));
      params.set('limit', '50');

      const res = await fetch(`/api/audit-logs?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        if (data.pagination) {
          setPagination(data.pagination);
        }
      } else {
        addToast(tRef.current('Failed to load audit logs', 'မှတ်တမ်းများ ဖတ်မရပါ'), 'error');
      }
    } catch {
      addToast(tRef.current('Failed to load audit logs', 'မှတ်တမ်းများ ဖတ်မရပါ'), 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, actionFilter, userFilter, search, addToast]);

  function handleExportCsv() {
    if (logs.length === 0) {
      addToast(t('No audit logs to export', 'ထုတ်ယူရန် မှတ်တမ်း မရှိပါ'), 'warning');
      return;
    }
    const header = ['Timestamp', 'User', 'Role', 'Action', 'Entity', 'Entity ID', 'Summary', 'Metadata']
      .map(escapeCsvCell)
      .join(',');
    const rows = logs.map((l) =>
      [
        formatDateTime(l.createdAt),
        l.user?.name || l.userId,
        l.user?.role || '',
        l.action,
        l.entityType,
        l.entityId || '',
        l.summary,
        l.metadata ? JSON.stringify(l.metadata) : '',
      ]
        .map(escapeCsvCell)
        .join(',')
    );
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shwepos-audit-logs-${getMyanmarDateKey()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast(t('Audit logs exported to CSV', 'Audit မှတ်တမ်းများ CSV ထုတ်ယူပြီးပါပြီ'), 'success');
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Security Audit Logs', 'လုံခြုံရေးနှင့် လုပ်ဆောင်ချက် မှတ်တမ်းများ')}</h1>
          <p className="page-subtitle mm-text">
            {t(
              'Immutable trail of voids, refunds, price overrides, stock adjustments & admin changes',
              'ဘောင်ချာပယ်ဖျက်ခြင်း၊ ဈေးပြင်ခြင်း၊ Stock ချိန်ညှိခြင်းနှင့် အရေးကြီးလုပ်ဆောင်ချက်မှတ်တမ်းများ'
            )}
          </p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleExportCsv}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={15} strokeWidth={1.75} />
            {t('Export CSV', 'CSV ထုတ်ရန်')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void fetchLogs(1)}
            disabled={loading}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={15} strokeWidth={1.75} />
            {loading ? t('Loading...', 'ရှာနေသည်...') : t('Apply Filters', 'စစ်ထုတ်မည်')}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div
          className="glass-card"
          style={{
            marginBottom: 'var(--space-lg)',
            padding: 'var(--space-md)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-sm)',
            alignItems: 'flex-end',
          }}
        >
          <div className="input-group" style={{ margin: 0, flex: '1 1 200px' }}>
            <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>
              {t('search')}
            </label>
            <input
              type="text"
              className="input"
              placeholder={t('Invoice, product, summary...', 'ဘောင်ချာ၊ ပစ္စည်းအမည် ရှာပါ...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>
              {t('From', 'မှ')}
            </label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: 150 }}
            />
          </div>
          <div className="input-group" style={{ margin: 0 }}>
            <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>
              {t('To', 'ထိ')}
            </label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: 150 }}
            />
          </div>
          <div className="input-group" style={{ margin: 0, minWidth: 190 }}>
            <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>
              {t('Action Type', 'လုပ်ဆောင်ချက်အမျိုးအစား')}
            </label>
            <select
              className="input"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">{t('All Actions', 'လုပ်ဆောင်ချက်အားလုံး')}</option>
              {ACTION_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {getActionLabel(a)}
                </option>
              ))}
            </select>
          </div>
          <div className="input-group" style={{ margin: 0, minWidth: 160 }}>
            <label className="input-label" style={{ fontSize: 'var(--text-xs)' }}>
              {t('Staff / User', 'ဝန်ထမ်း')}
            </label>
            <select
              className="input"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            >
              <option value="">{t('All Users', 'အသုံးပြုသူအားလုံး')}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({t(u.role.toLowerCase())})
                </option>
              ))}
            </select>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ShieldCheck size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-title">{t('No audit records found', 'လုပ်ဆောင်ချက်မှတ်တမ်း မတွေ့ပါ')}</div>
            <div className="empty-state-text">
              {t(
                'Sensitive actions such as voids, refunds, price overrides, and stock adjustments will appear here automatically.',
                'ဘောင်ချာပယ်ဖျက်ခြင်း၊ ဈေးပြင်ရောင်းခြင်းနှင့် Stock ချိန်ညှိမှုများ လုပ်ဆောင်ပါက ဤနေရာတွင် အလိုအလျောက် မှတ်တမ်းတင်ပါမည်။'
              )}
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Date & Time', 'ရက်စွဲနှင့်အချိန်')}</th>
                  <th>{t('User', 'ဝန်ထမ်း')}</th>
                  <th>{t('Action', 'လုပ်ဆောင်ချက်')}</th>
                  <th>{t('Entity', 'အမျိုးအစား')}</th>
                  <th>{t('Summary', 'အကျဉ်းချုပ်')}</th>
                  <th style={{ width: 60 }}>{t('Details', 'အသေးစိတ်')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontSize: 'var(--text-xs)', whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {log.user?.name || '—'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {log.user?.role ? t(log.user.role.toLowerCase()) : ''}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`badge ${getActionBadgeClass(log.action)}`}
                        style={{ fontSize: '11px' }}
                        title={log.action}
                      >
                        {getActionLabel(log.action)}
                      </span>
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>
                      {getEntityLabel(log.entityType)}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)', maxWidth: 420 }}>
                      {log.summary}
                    </td>
                    <td>
                      {log.metadata && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelectedLog(log)}
                          title={t('Inspect metadata', 'အသေးစိတ်ကြည့်ရန်')}
                        >
                          <Eye size={15} strokeWidth={1.75} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 'var(--space-sm) var(--space-md)',
                borderTop: '1px solid var(--border-color)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
              }}
            >
              <span>
                {t('Showing page', 'စာမျက်နှာ')} {pagination.page} / {pagination.totalPages} · {pagination.total.toLocaleString()} {t('records', 'မှတ်တမ်း')}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={loading || pagination.page <= 1}
                  onClick={() => void fetchLogs(pagination.page - 1)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <ChevronLeft size={14} strokeWidth={1.75} />
                  {t('Previous', 'ရှေ့သို့')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={loading || pagination.page >= pagination.totalPages}
                  onClick={() => void fetchLogs(pagination.page + 1)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  {t('Next', 'နောက်သို့')}
                  <ChevronRight size={14} strokeWidth={1.75} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="modal-title">{getActionLabel(selectedLog.action)}</h2>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setSelectedLog(null)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 'var(--text-sm)' }}>
                <strong>{t('Summary', 'အကျဉ်းချုပ်')}:</strong> {selectedLog.summary}
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {selectedLog.user?.name} ({selectedLog.user?.role ? t(selectedLog.user.role.toLowerCase()) : ''}) · {formatDateTime(selectedLog.createdAt)}
              </div>
              <pre
                style={{
                  background: 'var(--bg-secondary)',
                  padding: 'var(--space-md)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                  overflowX: 'auto',
                  maxHeight: 320,
                }}
              >
                {JSON.stringify(selectedLog.metadata, null, 2)}
              </pre>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
