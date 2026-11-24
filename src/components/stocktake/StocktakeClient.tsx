'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { useAppStore } from '@/lib/store';
import { useSettingsStore } from '@/store/settingsStore';
import {
  formatCurrency,
  formatDateTime,
  formatQuantity,
  isFractionalUnit,
  roundQuantity,
} from '@/lib/utils';
import { printElementById } from '@/lib/print';
import {
  ClipboardCheck,
  Plus,
  Printer,
  CheckCircle2,
  Ban,
  Camera,
  Eye,
  X,
  ChevronLeft,
} from '@/components/ui/Icons';
import type { StocktakeItemDTO, StocktakeSessionDTO } from '@/types';
import { CameraBarcodeModal } from '@/components/ui/CameraBarcodeModal';

interface CategoryOption {
  id: string;
  name: string;
  nameMm: string | null;
}

interface StocktakeClientProps {
  initialSessions: StocktakeSessionDTO[];
  categories: CategoryOption[];
}

export function StocktakeClient({ initialSessions, categories }: StocktakeClientProps) {
  const { language, t } = useI18n();
  const { addToast } = useToast();
  const businessName = useSettingsStore((s) => s.businessName);

  const [sessions, setSessions] = useState<StocktakeSessionDTO[]>(initialSessions);
  const [activeSession, setActiveSession] = useState<StocktakeSessionDTO | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Create session modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [creating, setCreating] = useState(false);

  // Active workspace editing
  const [draftCounts, setDraftCounts] = useState<Record<string, string>>({});
  const [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [scanInput, setScanInput] = useState('');
  const [filterMode, setFilterMode] = useState<'ALL' | 'UNCOUNTED' | 'VARIANCE'>('ALL');
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);

  function hydrateDrafts(session: StocktakeSessionDTO) {
    const counts: Record<string, string> = {};
    const notes: Record<string, string> = {};
    (session.items ?? []).forEach((item) => {
      counts[item.id] = item.countedQty === null ? '' : String(item.countedQty);
      notes[item.id] = item.notes || '';
    });
    setDraftCounts(counts);
    setDraftNotes(notes);
  }

  async function openSession(id: string) {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/stocktake/${id}`);
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to load stocktake', 'စာရင်းဖွင့်မရပါ'), 'error');
        return;
      }
      setActiveSession(data);
      hydrateDrafts(data);
      setFilterMode('ALL');
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleCreateSession() {
    setCreating(true);
    try {
      const res = await fetch('/api/stocktake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: newCategoryId || null,
          notes: newNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to start stocktake', 'စတင်မရပါ'), 'error');
        return;
      }
      setSessions((prev) => [data, ...prev]);
      setActiveSession(data);
      hydrateDrafts(data);
      setShowCreateModal(false);
      setNewCategoryId('');
      setNewNotes('');
      addToast(t('Stocktake session started', 'ကုန်လက်ကျန်စစ်ဆေးမှု စတင်ပြီးပါပြီ'), 'success');
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    } finally {
      setCreating(false);
    }
  }

  function handleBarcodeScan(code: string) {
    if (!activeSession || activeSession.status !== 'IN_PROGRESS') return;
    const cleaned = code.trim().toLowerCase();
    if (!cleaned) return;

    const match = (activeSession.items ?? []).find(
      (item) =>
        item.product?.barcode?.toLowerCase() === cleaned ||
        item.product?.sku.toLowerCase() === cleaned
    );
    if (!match) {
      addToast(
        t(`No product found for "${code}"`, `"${code}" နှင့်ကိုက်ညီသော ပစ္စည်းမတွေ့ပါ`),
        'error'
      );
      return;
    }

    const currentStr = draftCounts[match.id];
    const currentNum = currentStr === '' || currentStr === undefined ? 0 : parseFloat(currentStr) || 0;
    const nextNum = roundQuantity(currentNum + 1);
    setDraftCounts((prev) => ({ ...prev, [match.id]: String(nextNum) }));
    addToast(
      `${match.product?.name}: ${formatQuantity(nextNum, match.product?.unit)} ${match.product?.unit || ''}`,
      'info'
    );
    setScanInput('');
    scanInputRef.current?.focus();
  }

  async function saveCounts(): Promise<StocktakeSessionDTO | null> {
    if (!activeSession) return null;
    setSaving(true);
    try {
      const itemsPayload = (activeSession.items ?? []).map((item) => {
        const raw = (draftCounts[item.id] ?? '').trim();
        return {
          itemId: item.id,
          countedQty: raw === '' ? null : Math.max(0, roundQuantity(parseFloat(raw) || 0)),
          notes: draftNotes[item.id]?.trim() || null,
        };
      });

      const res = await fetch(`/api/stocktake/${activeSession.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: itemsPayload }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to save counts', 'သိမ်းဆည်းမရပါ'), 'error');
        return null;
      }
      setActiveSession(data);
      hydrateDrafts(data);
      setSessions((prev) => prev.map((s) => (s.id === data.id ? { ...s, ...data } : s)));
      addToast(t('Counts saved', 'ရေတွက်မှုများ သိမ်းဆည်းပြီးပါပြီ'), 'success');
      return data;
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function handleCompleteSession() {
    if (!activeSession) return;
    setCompleting(true);
    try {
      const saved = await saveCounts();
      if (!saved) return;

      const res = await fetch(`/api/stocktake/${activeSession.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applyUncountedAsZero: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to complete stocktake', 'အတည်ပြုမရပါ'), 'error');
        return;
      }
      setActiveSession(data);
      hydrateDrafts(data);
      setSessions((prev) => prev.map((s) => (s.id === data.id ? { ...s, ...data } : s)));
      useAppStore.getState().triggerLowStockRefresh();
      addToast(
        t(
          'Stocktake completed & inventory adjusted',
          'ကုန်လက်ကျန်စစ်ဆေးမှု အတည်ပြုပြီး Stock ချိန်ညှိပြီးပါပြီ'
        ),
        'success'
      );
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    } finally {
      setCompleting(false);
    }
  }

  async function handleCancelSession(id: string) {
    try {
      const res = await fetch(`/api/stocktake/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to cancel stocktake', 'ပယ်ဖျက်မရပါ'), 'error');
        return;
      }
      setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, status: 'CANCELLED' } : s)));
      if (activeSession?.id === id) setActiveSession(data);
      addToast(t('Stocktake cancelled', 'ပယ်ဖျက်ပြီးပါပြီ'), 'info');
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    }
  }

  const liveMetrics = useMemo(() => {
    const items = activeSession?.items ?? [];
    let counted = 0;
    let varianceItems = 0;
    let netVarianceVal = 0;

    for (const item of items) {
      const raw = (draftCounts[item.id] ?? '').trim();
      if (raw !== '') {
        counted += 1;
        const cNum = parseFloat(raw);
        if (Number.isFinite(cNum)) {
          const diff = roundQuantity(cNum - item.systemQty);
          if (Math.abs(diff) > 0.0001) {
            varianceItems += 1;
            netVarianceVal += diff * item.unitCost;
          }
        }
      }
    }
    return { total: items.length, counted, varianceItems, netVarianceVal: Math.round(netVarianceVal) };
  }, [activeSession, draftCounts]);

  const filteredItems = useMemo(() => {
    const items = activeSession?.items ?? [];
    return items.filter((item) => {
      const raw = (draftCounts[item.id] ?? '').trim();
      if (filterMode === 'UNCOUNTED') return raw === '';
      if (filterMode === 'VARIANCE') {
        if (raw === '') return false;
        const diff = roundQuantity((parseFloat(raw) || 0) - item.systemQty);
        return Math.abs(diff) > 0.0001;
      }
      return true;
    });
  }, [activeSession, draftCounts, filterMode]);

  function getStatusLabel(status: string) {
    if (status === 'COMPLETED') return t('Completed', 'ပြီးစီးပြီး');
    if (status === 'CANCELLED') return t('Cancelled', 'ပယ်ဖျက်ပြီး');
    return t('In Progress', 'စစ်ဆေးနေဆဲ');
  }

  function getStatusBadge(status: string) {
    if (status === 'COMPLETED') return 'badge-success';
    if (status === 'CANCELLED') return 'badge-danger';
    return 'badge-warning';
  }

  if (activeSession) {
    const isEditable = activeSession.status === 'IN_PROGRESS';
    return (
      <>
        <div className="page-header">
          <div className="page-title-group">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setActiveSession(null)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <ChevronLeft size={16} />
                {t('Back', 'နောက်သို့')}
              </button>
              <h1 className="page-title" style={{ margin: 0 }}>
                {activeSession.sessionNumber}
              </h1>
              <span className={`badge ${getStatusBadge(activeSession.status)}`}>
                {getStatusLabel(activeSession.status)}
              </span>
            </div>
            <p className="page-subtitle">
              {activeSession.category
                ? language === 'mm' && activeSession.category.nameMm
                  ? activeSession.category.nameMm
                  : activeSession.category.name
                : t('All Categories', 'အမျိုးအစားအားလုံး')}{' '}
              · {formatDateTime(activeSession.createdAt)}
            </p>
          </div>
          <div className="page-actions" style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() =>
                printElementById('stocktake-print-area', {
                  title: `${activeSession.sessionNumber} - Stocktake Report`,
                  paperSize: 'A4',
                })
              }
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Printer size={14} strokeWidth={1.75} />
              {t('Print Variance Report', 'ကွာဟမှုအစီရင်ခံစာ ထုတ်ရန်')}
            </button>
            {isEditable && (
              <>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={saveCounts}
                  disabled={saving || completing}
                >
                  {saving ? t('Saving...', 'သိမ်းနေသည်...') : t('Save Progress', 'ယာယီသိမ်းရန်')}
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleCompleteSession}
                  disabled={saving || completing || liveMetrics.counted === 0}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <CheckCircle2 size={14} strokeWidth={1.75} />
                  {completing
                    ? t('Applying...', 'ချိန်ညှိနေသည်...')
                    : t('Complete & Apply Stock', 'အတည်ပြုပြီး Stock ချိန်ညှိရန်')}
                </button>
              </>
            )}
          </div>
        </div>

        <div className="page-body">
          {/* KPI Strip */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
              gap: 'var(--space-md)',
              marginBottom: 'var(--space-lg)',
            }}
          >
            <div className="kpi-card">
              <div className="kpi-label">{t('Counted Progress', 'ရေတွက်ပြီး')}</div>
              <div className="kpi-value">
                {liveMetrics.counted} / {liveMetrics.total}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">{t('Items With Variance', 'ကွာဟသည့်ပစ္စည်း')}</div>
              <div
                className="kpi-value"
                style={{ color: liveMetrics.varianceItems > 0 ? 'var(--warning)' : 'var(--success)' }}
              >
                {liveMetrics.varianceItems}
              </div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">{t('Net Variance Value', 'စုစုပေါင်းကွာဟတန်ဖိုး')}</div>
              <div
                className="kpi-value"
                style={{
                  color:
                    liveMetrics.netVarianceVal < 0
                      ? 'var(--danger)'
                      : liveMetrics.netVarianceVal > 0
                        ? 'var(--success)'
                        : undefined,
                }}
              >
                {liveMetrics.netVarianceVal > 0 ? '+' : ''}
                {formatCurrency(liveMetrics.netVarianceVal)}
              </div>
            </div>
          </div>

          {/* Scan & Filter Bar */}
          <div
            className="flex gap-sm"
            style={{ marginBottom: 'var(--space-md)', flexWrap: 'wrap', alignItems: 'center' }}
          >
            {isEditable && (
              <div style={{ display: 'flex', gap: 6, flex: '1 1 280px', maxWidth: 420 }}>
                <input
                  ref={scanInputRef}
                  type="text"
                  className="input input-search"
                  placeholder={t(
                    'Scan barcode or type SKU + Enter to +1...',
                    'ဘားကုဒ် Scan ဖတ်ပါ သို့မဟုတ် SKU ရိုက်ပြီး Enter နှိပ်ပါ (+1)...'
                  )}
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeScan(scanInput);
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCameraScanner(true)}
                  title={t('Scan with Camera', 'ကင်မရာဖြင့် ဘားကုဒ်ဖတ်ရန်')}
                >
                  <Camera size={16} strokeWidth={1.75} />
                </button>
              </div>
            )}
            <div className="flex gap-xs">
              {(['ALL', 'UNCOUNTED', 'VARIANCE'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`btn btn-sm ${filterMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setFilterMode(mode)}
                >
                  {mode === 'ALL'
                    ? t('All', 'အားလုံး')
                    : mode === 'UNCOUNTED'
                      ? t('Uncounted', 'မရေတွက်ရသေး')
                      : t('Variances Only', 'ကွာဟချက်များသာ')}
                </button>
              ))}
            </div>
          </div>

          {/* Printable Table Wrapper */}
          <div id="stocktake-print-area">
            <div className="print-only" style={{ marginBottom: 12 }}>
              <h2 style={{ margin: 0 }}>{businessName} — Stocktake Variance Report</h2>
              <div style={{ fontSize: 12 }}>
                {activeSession.sessionNumber} · {formatDateTime(activeSession.createdAt)} ·{' '}
                {t('Net Variance', 'ကွာဟတန်ဖိုး')}: {formatCurrency(liveMetrics.netVarianceVal)}
              </div>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                    <th>SKU / Barcode</th>
                    <th style={{ textAlign: 'right' }}>{t('System Qty', 'စနစ်လက်ကျန်')}</th>
                    <th style={{ textAlign: 'right', width: 130 }}>{t('Counted Qty', 'ရေတွက်ရရှိ')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Variance', 'ကွာဟချက်')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Variance Value', 'ကွာဟတန်ဖိုး')}</th>
                    <th>{t('Notes', 'မှတ်စု')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item: StocktakeItemDTO) => {
                    const raw = (draftCounts[item.id] ?? '').trim();
                    const hasCount = raw !== '';
                    const countedVal = hasCount ? parseFloat(raw) || 0 : null;
                    const diff = countedVal === null ? 0 : roundQuantity(countedVal - item.systemQty);
                    const diffVal = countedVal === null ? 0 : Math.round(diff * item.unitCost);
                    const fractional = isFractionalUnit(item.product?.unit);

                    return (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                            {language === 'mm' && item.product?.nameMm
                              ? item.product.nameMm
                              : item.product?.name}
                          </div>
                          {item.product?.category && (
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                              {item.product.category.name}
                            </div>
                          )}
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                          <div>{item.product?.sku}</div>
                          {item.product?.barcode && (
                            <div style={{ color: 'var(--text-muted)' }}>{item.product.barcode}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {formatQuantity(item.systemQty, item.product?.unit)} {item.product?.unit}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isEditable ? (
                            <input
                              type="number"
                              min="0"
                              step={fractional ? '0.01' : '1'}
                              className="input"
                              style={{ width: 104, textAlign: 'right', marginLeft: 'auto', fontFamily: 'var(--font-mono)' }}
                              placeholder="—"
                              value={draftCounts[item.id] ?? ''}
                              onChange={(e) =>
                                setDraftCounts((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                            />
                          ) : (
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                              {countedVal === null
                                ? '—'
                                : `${formatQuantity(countedVal, item.product?.unit)} ${item.product?.unit || ''}`}
                            </span>
                          )}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 700,
                            color:
                              !hasCount || Math.abs(diff) < 0.0001
                                ? 'var(--text-muted)'
                                : diff < 0
                                  ? 'var(--danger)'
                                  : 'var(--success)',
                          }}
                        >
                          {!hasCount
                            ? '—'
                            : `${diff > 0 ? '+' : ''}${formatQuantity(diff, item.product?.unit)}`}
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            color:
                              !hasCount || diffVal === 0
                                ? 'var(--text-muted)'
                                : diffVal < 0
                                  ? 'var(--danger)'
                                  : 'var(--success)',
                          }}
                        >
                          {!hasCount
                            ? '—'
                            : `${diffVal > 0 ? '+' : ''}${formatCurrency(diffVal)}`}
                        </td>
                        <td>
                          {isEditable ? (
                            <input
                              type="text"
                              className="input"
                              style={{ fontSize: 'var(--text-xs)', minWidth: 120 }}
                              placeholder={t('Reason...', 'မှတ်ချက်...')}
                              value={draftNotes[item.id] ?? ''}
                              onChange={(e) =>
                                setDraftNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                            />
                          ) : (
                            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                              {item.notes || '—'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <CameraBarcodeModal
          isOpen={showCameraScanner}
          onDetected={(code) => handleBarcodeScan(code)}
          onClose={() => setShowCameraScanner(false)}
        />
      </>
    );
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Stocktake / Physical Count', 'ကုန်လက်ကျန် စစ်ဆေးတိုက်ဆိုင်မှု')}</h1>
          <p className="page-subtitle mm-text">
            {t(
              'Verify physical shelf stock against system inventory and apply batch adjustments',
              'ဆိုင်တွင်းရှိ တကယ့်ကုန်ပစ္စည်းလက်ကျန်နှင့် စနစ်လက်ကျန်ကို တိုက်ဆိုင်စစ်ဆေးချိန်ညှိပါ'
            )}
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} strokeWidth={2} />
            {t('New Stocktake', 'စစ်ဆေးမှုအသစ် စတင်ရန်')}
          </button>
        </div>
      </div>

      <div className="page-body">
        {sessions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ClipboardCheck size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-title">
              {t('No stocktake sessions yet', 'ကုန်လက်ကျန်စစ်ဆေးမှု မှတ်တမ်းမရှိသေးပါ')}
            </div>
            <div className="empty-state-text">
              {t(
                'Start a stocktake session to count products with barcode scanning and track shrinkage.',
                'ဘားကုဒ် Scan ဖတ်၍ ပစ္စည်းလက်ကျန်စစ်ဆေးရန် စစ်ဆေးမှုအသစ် စတင်ပါ။'
              )}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} strokeWidth={2} />
              {t('New Stocktake', 'စစ်ဆေးမှုအသစ် စတင်ရန်')}
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Session #', 'အမှတ်စဉ်')}</th>
                  <th>{t('Scope', 'အမျိုးအစား')}</th>
                  <th>{t('Created By', 'စတင်သူ')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Items', 'ပစ္စည်းအရေအတွက်')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Variances', 'ကွာဟချက်')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Variance Value', 'ကွာဟတန်ဖိုး')}</th>
                  <th>{t('Status', 'အခြေအနေ')}</th>
                  <th>{t('Date', 'ရက်စွဲ')}</th>
                  <th style={{ width: 110 }}>{t('Actions', 'လုပ်ဆောင်ချက်')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                      {s.sessionNumber}
                    </td>
                    <td>
                      {s.category
                        ? language === 'mm' && s.category.nameMm
                          ? s.category.nameMm
                          : s.category.name
                        : t('All Products', 'ကုန်ပစ္စည်းအားလုံး')}
                    </td>
                    <td>{s.user?.name || '—'}</td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {s.totalItems}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {s.varianceItems}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color:
                          s.totalVarianceValue < 0
                            ? 'var(--danger)'
                            : s.totalVarianceValue > 0
                              ? 'var(--success)'
                              : 'var(--text-muted)',
                      }}
                    >
                      {s.totalVarianceValue > 0 ? '+' : ''}
                      {formatCurrency(s.totalVarianceValue)}
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadge(s.status)}`}>
                        {getStatusLabel(s.status)}
                      </span>
                    </td>
                    <td style={{ fontSize: 'var(--text-xs)' }}>{formatDateTime(s.createdAt)}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={loadingDetail}
                          onClick={() => openSession(s.id)}
                          title={t('Open Session', 'ဖွင့်ကြည့်ရန်')}
                        >
                          <Eye size={15} strokeWidth={1.75} />
                        </button>
                        {s.status === 'IN_PROGRESS' && (
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleCancelSession(s.id)}
                            title={t('Cancel', 'ပယ်ဖျက်ရန်')}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Ban size={15} strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {t('Start Stocktake Session', 'ကုန်လက်ကျန်စစ်ဆေးမှု စတင်ရန်')}
              </h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setShowCreateModal(false)}
              >
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">
                  {t('Category Scope (Optional)', 'စစ်ဆေးမည့် အမျိုးအစား (ရွေးချယ်)')}
                </label>
                <select
                  className="input"
                  value={newCategoryId}
                  onChange={(e) => setNewCategoryId(e.target.value)}
                >
                  <option value="">{t('All Active Products', 'ကုန်ပစ္စည်းအားလုံး')}</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {language === 'mm' && cat.nameMm ? `${cat.name} (${cat.nameMm})` : cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">{t('Notes', 'မှတ်စု')}</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder={t('e.g. Month-end physical count', 'ဥပမာ လကုန် ကုန်လက်ကျန်စစ်ဆေးမှု')}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                {t('Cancel', 'မလုပ်တော့ပါ')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateSession}
                disabled={creating}
              >
                {creating
                  ? t('Starting...', 'စတင်နေသည်...')
                  : t('Start Counting', 'စတင်ရေတွက်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
