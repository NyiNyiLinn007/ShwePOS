'use client';

import React, { useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  const router = useRouter();
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
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [cancelConfirmTarget, setCancelConfirmTarget] = useState<StocktakeSessionDTO | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  function parseDraftCount(raw: string | undefined): { valid: boolean; value: number | null } {
    const trimmed = (raw ?? '').trim();
    if (trimmed === '') return { valid: true, value: null };
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { valid: false, value: null };
    }
    return { valid: true, value: roundQuantity(parsed) };
  }

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
      router.refresh();
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

    let match: StocktakeItemDTO | undefined;
    let incrementQty = 1;
    let matchedUnitLabel: string | null = null;

    for (const item of activeSession.items ?? []) {
      if (
        item.product?.barcode?.toLowerCase() === cleaned ||
        item.product?.sku.toLowerCase() === cleaned
      ) {
        match = item;
        incrementQty = 1;
        break;
      }
      const matchedUnit = item.product?.productUnits?.find(
        (u) => u.barcode && u.barcode.toLowerCase() === cleaned
      );
      if (matchedUnit) {
        match = item;
        incrementQty = roundQuantity(matchedUnit.conversionFactor);
        matchedUnitLabel = `${matchedUnit.unitName} (+${formatQuantity(incrementQty, item.product?.unit)})`;
        break;
      }
    }

    if (!match) {
      addToast(
        t(`No product found for "${code}"`, `"${code}" နှင့်ကိုက်ညီသော ပစ္စည်းမတွေ့ပါ`),
        'error'
      );
      return;
    }

    const parsedCurrent = parseDraftCount(draftCounts[match.id]);
    const currentNum = parsedCurrent.valid && parsedCurrent.value !== null ? parsedCurrent.value : 0;
    const nextNum = roundQuantity(currentNum + incrementQty);
    setDraftCounts((prev) => ({ ...prev, [match!.id]: String(nextNum) }));
    addToast(
      matchedUnitLabel
        ? `${match.product?.name} [${matchedUnitLabel}]: ${formatQuantity(nextNum, match.product?.unit)} ${match.product?.unit || ''}`
        : `${match.product?.name}: ${formatQuantity(nextNum, match.product?.unit)} ${match.product?.unit || ''}`,
      'info'
    );
    setScanInput('');
    scanInputRef.current?.focus();
  }

  async function saveCounts(): Promise<StocktakeSessionDTO | null> {
    if (!activeSession) return null;
    setSaving(true);
    try {
      // Validate all edited counts before sending so invalid text or decimals on integer units are rejected cleanly
      const changedPayload: Array<{ itemId: string; countedQty: number | null; notes: string | null }> = [];
      for (const item of activeSession.items ?? []) {
        const parsed = parseDraftCount(draftCounts[item.id]);
        const displayName =
          language === 'mm' && item.product?.nameMm
            ? item.product.nameMm
            : item.product?.name || 'Item';
        if (!parsed.valid) {
          addToast(
            language === 'mm'
              ? `${displayName} အတွက် မှန်ကန်သော အရေအတွက် ထည့်သွင်းပါ`
              : `Invalid counted quantity for ${displayName}`,
            'error'
          );
          return null;
        }
        const unit = item.product?.unit;
        if (parsed.value !== null && !isFractionalUnit(unit) && !Number.isInteger(parsed.value)) {
          addToast(
            language === 'mm'
              ? `${displayName} (${unit || 'pcs'}) အတွက် ကိန်းပြည့်အရေအတွက်သာ ထည့်သွင်းနိုင်ပါသည်`
              : `${displayName} (${unit || 'pcs'}) requires a whole number quantity`,
            'error'
          );
          return null;
        }
        const nextNote = draftNotes[item.id]?.trim() || null;
        const origCounted =
          item.countedQty !== null && item.countedQty !== undefined
            ? roundQuantity(item.countedQty)
            : null;
        const origNote = item.notes?.trim() || null;

        if (parsed.value !== origCounted || nextNote !== origNote) {
          changedPayload.push({
            itemId: item.id,
            countedQty: parsed.value,
            notes: nextNote,
          });
        }
      }

      if (changedPayload.length === 0) {
        return activeSession;
      }

      const CHUNK_SIZE = 250;
      let latestSession: StocktakeSessionDTO = activeSession;
      for (let i = 0; i < changedPayload.length; i += CHUNK_SIZE) {
        const chunk = changedPayload.slice(i, i + CHUNK_SIZE);
        const res = await fetch(`/api/stocktake/${activeSession.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: chunk }),
        });
        const data = await res.json();
        if (!res.ok) {
          addToast(data.error || t('Failed to save counts', 'သိမ်းဆည်းမရပါ'), 'error');
          return null;
        }
        latestSession = data;
      }

      setActiveSession(latestSession);
      hydrateDrafts(latestSession);
      setSessions((prev) => prev.map((s) => (s.id === latestSession.id ? { ...s, ...latestSession } : s)));
      addToast(t('Counts saved', 'ရေတွက်မှုများ သိမ်းဆည်းပြီးပါပြီ'), 'success');
      return latestSession;
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
      setShowCompleteConfirm(false);
      useAppStore.getState().triggerLowStockRefresh();
      router.refresh();
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
      setCancelConfirmTarget(null);
      router.refresh();
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
      const parsed = parseDraftCount(draftCounts[item.id]);
      if (parsed.valid && parsed.value !== null) {
        counted += 1;
        const diff = roundQuantity(parsed.value - item.systemQty);
        if (Math.abs(diff) > 0.0001) {
          varianceItems += 1;
          netVarianceVal += diff * item.unitCost;
        }
      }
    }
    return { total: items.length, counted, varianceItems, netVarianceVal: Math.round(netVarianceVal) };
  }, [activeSession, draftCounts]);

  const filteredItems = useMemo(() => {
    const items = activeSession?.items ?? [];
    return items.filter((item) => {
      const parsed = parseDraftCount(draftCounts[item.id]);
      if (filterMode === 'UNCOUNTED') return parsed.value === null;
      if (filterMode === 'VARIANCE') {
        if (!parsed.valid || parsed.value === null) return false;
        const diff = roundQuantity(parsed.value - item.systemQty);
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
                  onClick={() => setShowCompleteConfirm(true)}
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

          {/* Interactive Workspace Table */}
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
                  const parsed = parseDraftCount(draftCounts[item.id]);
                  const hasCount = parsed.valid && parsed.value !== null;
                  const countedVal = hasCount ? parsed.value : null;
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
                            className={`input${!parsed.valid ? ' input-error' : ''}`}
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

          {/* Dedicated Full-Session Plain-Text Print Report (always prints all items & live counts) */}
          <div style={{ display: 'none' }} aria-hidden="true">
            <div id="stocktake-print-area" style={{ fontFamily: 'Arial, sans-serif', fontSize: 12, color: '#000' }}>
              <div style={{ borderBottom: '2px solid #000', paddingBottom: 8, marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>{businessName} — Stocktake Variance Report</h2>
                <div style={{ fontSize: 11, marginTop: 4 }}>
                  {activeSession.sessionNumber} · {getStatusLabel(activeSession.status)} · {formatDateTime(activeSession.createdAt)}
                </div>
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  {t('Counted', 'ရေတွက်ပြီး')}: {liveMetrics.counted}/{liveMetrics.total} ·{' '}
                  {t('Variances', 'ကွာဟသည့်ပစ္စည်း')}: {liveMetrics.varianceItems} ·{' '}
                  {t('Net Variance', 'ကွာဟတန်ဖိုး')}: {liveMetrics.netVarianceVal > 0 ? '+' : ''}
                  {formatCurrency(liveMetrics.netVarianceVal)}
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #000', background: '#f1f5f9' }}>
                    <th style={{ padding: 5, textAlign: 'left' }}>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                    <th style={{ padding: 5, textAlign: 'left' }}>SKU</th>
                    <th style={{ padding: 5, textAlign: 'right' }}>{t('System Qty', 'စနစ်လက်ကျန်')}</th>
                    <th style={{ padding: 5, textAlign: 'right' }}>{t('Counted Qty', 'ရေတွက်ရရှိ')}</th>
                    <th style={{ padding: 5, textAlign: 'right' }}>{t('Variance', 'ကွာဟချက်')}</th>
                    <th style={{ padding: 5, textAlign: 'right' }}>{t('Variance Value', 'ကွာဟတန်ဖိုး')}</th>
                    <th style={{ padding: 5, textAlign: 'left' }}>{t('Notes', 'မှတ်စု')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(activeSession.items ?? []).map((item) => {
                    const parsed = parseDraftCount(draftCounts[item.id]);
                    const hasCount = parsed.valid && parsed.value !== null;
                    const countedVal = hasCount ? parsed.value : null;
                    const diff = countedVal === null ? 0 : roundQuantity(countedVal - item.systemQty);
                    const diffVal = countedVal === null ? 0 : Math.round(diff * item.unitCost);
                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid #cbd5e1' }}>
                        <td style={{ padding: 5 }}>
                          {language === 'mm' && item.product?.nameMm
                            ? item.product.nameMm
                            : item.product?.name}
                        </td>
                        <td style={{ padding: 5, fontFamily: 'monospace' }}>{item.product?.sku}</td>
                        <td style={{ padding: 5, textAlign: 'right', fontFamily: 'monospace' }}>
                          {formatQuantity(item.systemQty, item.product?.unit)} {item.product?.unit}
                        </td>
                        <td style={{ padding: 5, textAlign: 'right', fontFamily: 'monospace' }}>
                          {countedVal === null
                            ? '—'
                            : `${formatQuantity(countedVal, item.product?.unit)} ${item.product?.unit || ''}`}
                        </td>
                        <td style={{ padding: 5, textAlign: 'right', fontFamily: 'monospace' }}>
                          {!hasCount
                            ? '—'
                            : `${diff > 0 ? '+' : ''}${formatQuantity(diff, item.product?.unit)}`}
                        </td>
                        <td style={{ padding: 5, textAlign: 'right', fontFamily: 'monospace' }}>
                          {!hasCount
                            ? '—'
                            : `${diffVal > 0 ? '+' : ''}${formatCurrency(diffVal)}`}
                        </td>
                        <td style={{ padding: 5 }}>{draftNotes[item.id]?.trim() || item.notes || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {showCompleteConfirm && (
          <div className="modal-backdrop" onClick={() => !completing && setShowCompleteConfirm(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
              <div className="modal-header">
                <h2 className="modal-title">
                  {t('Confirm Stocktake Completion', 'ကုန်လက်ကျန်စစ်ဆေးမှု အတည်ပြုရန်')}
                </h2>
                <button
                  className="btn btn-ghost btn-icon"
                  disabled={completing}
                  onClick={() => setShowCompleteConfirm(false)}
                >
                  <X size={16} strokeWidth={1.75} />
                </button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
                  {t(
                    'Applying this stocktake will adjust live inventory quantities by each item\'s counted variance and lock the session permanently.',
                    'ဤစစ်ဆေးမှုကို အတည်ပြုပါက ရေတွက်ထားသော ကွာဟချက်အတိုင်း ကုန်လက်ကျန်များကို ချိန်ညှိပြီး စာရင်းကို အပြီးပိတ်သိမ်းပါမည်။'
                  )}
                </p>
                <div
                  style={{
                    padding: 'var(--space-md)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-secondary)',
                    fontSize: 'var(--text-sm)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div>
                    {t('Counted Items', 'ရေတွက်ပြီးပစ္စည်း')}:{' '}
                    <strong>{liveMetrics.counted} / {liveMetrics.total}</strong>
                  </div>
                  <div>
                    {t('Items With Variance', 'ကွာဟသည့်ပစ္စည်း')}:{' '}
                    <strong>{liveMetrics.varianceItems}</strong>
                  </div>
                  <div>
                    {t('Net Variance Value', 'စုစုပေါင်းကွာဟတန်ဖိုး')}:{' '}
                    <strong style={{ color: liveMetrics.netVarianceVal < 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {liveMetrics.netVarianceVal > 0 ? '+' : ''}
                      {formatCurrency(liveMetrics.netVarianceVal)}
                    </strong>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  disabled={completing}
                  onClick={() => setShowCompleteConfirm(false)}
                >
                  {t('Cancel', 'မလုပ်တော့ပါ')}
                </button>
                <button
                  className="btn btn-primary"
                  disabled={completing}
                  onClick={handleCompleteSession}
                >
                  {completing
                    ? t('Applying...', 'ချိန်ညှိနေသည်...')
                    : t('Confirm & Apply Stock', 'အတည်ပြုပြီး Stock ချိန်ညှိမည်')}
                </button>
              </div>
            </div>
          </div>
        )}

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
                            onClick={() => setCancelConfirmTarget(s)}
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
      {cancelConfirmTarget && (
        <div className="modal-backdrop" onClick={() => setCancelConfirmTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title">{t('Cancel Stocktake Session', 'စစ်ဆေးမှု ပယ်ဖျက်ရန်')}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setCancelConfirmTarget(null)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--text-sm)', margin: 0 }}>
                {t(
                  `Are you sure you want to cancel stocktake ${cancelConfirmTarget.sessionNumber}? No inventory quantities will be changed.`,
                  `${cancelConfirmTarget.sessionNumber} စစ်ဆေးမှုကို ပယ်ဖျက်ရန် သေချာပါသလား? ကုန်လက်ကျန်များ ပြောင်းလဲမည်မဟုတ်ပါ။`
                )}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCancelConfirmTarget(null)}>
                {t('Keep Open', 'ဆက်ဖွင့်ထားမည်')}
              </button>
              <button
                className="btn btn-danger"
                onClick={() => handleCancelSession(cancelConfirmTarget.id)}
              >
                {t('Cancel Stocktake', 'ပယ်ဖျက်မည်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
