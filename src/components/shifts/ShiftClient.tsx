'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { ArrowDownToLine, ArrowUpFromLine, Banknote, Clock } from '@/components/ui/Icons';

interface ShiftSummary {
  cashSales: number;
  refunds: number;
  paidIn: number;
  paidOut: number;
  expectedCash: number;
  movementCount: number;
}

interface CashMovement {
  id: string;
  type: string;
  amount: number;
  reason: string | null;
  createdAt: string;
}

interface Shift {
  id: string;
  userId: string;
  user: { id: string; name: string; email: string };
  openingCash: number;
  closingCash: number | null;
  expectedCash: number;
  actualCash: number | null;
  variance: number | null;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  summary: ShiftSummary;
  movements?: CashMovement[];
}

interface ShiftClientProps {
  userRole: string;
  userName: string;
}

export default function ShiftClient({ userRole, userName }: ShiftClientProps) {
  const { language, t } = useI18n();
  const { addToast } = useToast();
  const [current, setCurrent] = useState<Shift | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [openingCash, setOpeningCash] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);

  // Paid-In / Paid-Out state
  const [movementMode, setMovementMode] = useState<'PAID_IN' | 'PAID_OUT' | null>(null);
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');

  const isManager = userRole === 'ADMIN' || userRole === 'MANAGER';

  async function loadShifts() {
    setLoading(true);
    try {
      const response = await fetch('/api/shifts', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('loadingShift'));
      setCurrent(data.current ?? null);
      setShifts(data.shifts ?? []);
    } catch (error) {
      addToast(error instanceof Error ? error.message : t('loadingShift'), 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadShifts();
  }, []);

  useEffect(() => {
    if (current) {
      setActualCash(String(current.expectedCash));
    }
  }, [current]);

  const canCloseCurrent = current && (current.userId === current.user.id || isManager);
  const variancePreview = useMemo(() => {
    if (!current || actualCash.trim() === '') return null;
    const value = Number(actualCash);
    return Number.isFinite(value) ? Math.round((value - current.expectedCash) * 100) / 100 : null;
  }, [actualCash, current]);

  async function openShift() {
    const amount = Number(openingCash);
    if (!Number.isFinite(amount) || amount < 0) {
      addToast(t('Opening cash must be zero or more', 'အဖွင့်ငွေသည် သုည သို့မဟုတ် ထိုထက်ပိုရပါမည်'), 'error');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingCash: amount, notes: openingNotes || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('openShift'));
      addToast(t('shiftOpened'), 'success');
      setOpeningNotes('');
      await loadShifts();
    } catch (error) {
      addToast(error instanceof Error ? error.message : t('openShift'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function submitCashMovement() {
    if (!current || !movementMode) return;
    const amount = Number(movementAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      addToast(t('Amount must be greater than zero', 'ပမာဏသည် သုညထက် ကြီးရပါမည်'), 'error');
      return;
    }
    if (!movementReason.trim()) {
      addToast(t('Reason is required', 'အကြောင်းပြချက် ထည့်သွင်းရန် လိုအပ်ပါသည်'), 'error');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/shifts/${current.id}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: movementMode,
          amount,
          reason: movementReason.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to record movement');
      addToast(
        movementMode === 'PAID_IN'
          ? t('Cash paid-in recorded', 'ငွေသေတ္တာအတွင်း ငွေသွင်းခြင်း မှတ်တမ်းတင်ပြီးပါပြီ')
          : t('Cash paid-out recorded', 'ငွေသေတ္တာမှ ငွေထုတ်ခြင်း မှတ်တမ်းတင်ပြီးပါပြီ'),
        'success'
      );
      setMovementMode(null);
      setMovementAmount('');
      setMovementReason('');
      await loadShifts();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to record movement', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function closeShift() {
    if (!current) return;
    const amount = Number(actualCash);
    if (!Number.isFinite(amount) || amount < 0) {
      addToast(t('Actual cash must be zero or more', 'အမှန်တကယ်ငွေသည် သုည သို့မဟုတ် ထိုထက်ပိုရပါမည်'), 'error');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(`/api/shifts/${current.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actualCash: amount, notes: closingNotes || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('closeShift'));
      addToast(t('shiftClosed'), 'success');
      setShowCloseForm(false);
      setClosingNotes('');
      await loadShifts();
    } catch (error) {
      addToast(error instanceof Error ? error.message : t('closeShift'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className={`page-title${language === 'mm' ? ' mm-text' : ''}`}>
            {t('cashierShift')}
          </h1>
          <p className={`page-subtitle${language === 'mm' ? ' mm-text' : ''}`}>
            {t('shiftSubtitle')}
          </p>
        </div>
        <div className="page-actions">
          <span className="badge badge-neutral">{userName}</span>
          <Link className="btn btn-secondary" href="/pos">{t('openPos')}</Link>
        </div>
      </div>

      <div className="page-body shift-page-body">
        {loading ? (
          <div className="loading-page"><div className="loading-spinner" /><span>{t('loadingShift')}</span></div>
        ) : current ? (
          <section className="glass-card shift-current-card" aria-labelledby="current-shift-title">
            <div className="shift-card-header">
              <div>
                <span className="badge badge-success">{t('openStatus')}</span>
                <h2 id="current-shift-title" className="heading-4">{t('currentCashDrawer')}</h2>
                <p className="shift-muted">{t('opened')}: {formatDateTime(current.openedAt)}</p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowCloseForm(false);
                    setMovementMode(movementMode === 'PAID_IN' ? null : 'PAID_IN');
                  }}
                >
                  <ArrowDownToLine size={14} strokeWidth={1.75} /> {t('Paid In', 'ငွေသွင်း')}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setShowCloseForm(false);
                    setMovementMode(movementMode === 'PAID_OUT' ? null : 'PAID_OUT');
                  }}
                >
                  <ArrowUpFromLine size={14} strokeWidth={1.75} /> {t('Paid Out', 'ငွေထုတ်')}
                </button>
                <Link className="btn btn-primary btn-sm" href="/pos">{t('continueSelling')}</Link>
              </div>
            </div>

            <div className="shift-stat-grid">
              <div className="shift-stat"><span>{t('openingCash')}</span><strong>{formatCurrency(current.openingCash)}</strong></div>
              <div className="shift-stat"><span>{t('cashSales')}</span><strong>{formatCurrency(current.summary.cashSales)}</strong></div>
              <div className="shift-stat"><span>{t('Paid In / Out', 'ငွေသွင်း / ငွေထုတ်')}</span><strong>+{formatCurrency(current.summary.paidIn)} / −{formatCurrency(current.summary.paidOut)}</strong></div>
              <div className="shift-stat"><span>{t('Refunds', 'ပြန်အမ်းငွေ')}</span><strong className="text-danger">−{formatCurrency(current.summary.refunds)}</strong></div>
              <div className="shift-stat"><span>{t('expectedCash')}</span><strong>{formatCurrency(current.expectedCash)}</strong></div>
              <div className="shift-stat"><span>{t('transactions')}</span><strong>{current.summary.movementCount}</strong></div>
            </div>

            {movementMode && (
              <div className="shift-close-form" style={{ marginTop: 'var(--space-md)' }}>
                <h3 className="heading-4" style={{ marginBottom: 'var(--space-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {movementMode === 'PAID_IN' ? (
                    <>
                      <ArrowDownToLine size={16} strokeWidth={1.75} style={{ color: 'var(--success)' }} />
                      {t('Record Cash Paid-In (Add Float)', 'ငွေသေတ္တာအတွင်း ငွေထပ်ဖြည့်ရန်')}
                    </>
                  ) : (
                    <>
                      <ArrowUpFromLine size={16} strokeWidth={1.75} style={{ color: 'var(--danger)' }} />
                      {t('Record Cash Paid-Out (Petty Cash)', 'ငွေသေတ္တာမှ အသေးသုံးငွေထုတ်ရန်')}
                    </>
                  )}
                </h3>
                <div className="input-group">
                  <label className="input-label" htmlFor="movement-amount">
                    {t('amount')} (K)
                  </label>
                  <input
                    id="movement-amount"
                    className="input"
                    type="number"
                    min="1"
                    step="1"
                    value={movementAmount}
                    onChange={(e) => setMovementAmount(e.target.value)}
                    placeholder="0"
                    autoFocus
                  />
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="movement-reason">
                    {t('Reason', 'အကြောင်းပြချက်')} *
                  </label>
                  <input
                    id="movement-reason"
                    className="input"
                    value={movementReason}
                    onChange={(e) => setMovementReason(e.target.value)}
                    maxLength={500}
                    placeholder={
                      movementMode === 'PAID_IN'
                        ? t('e.g., Added small change notes', 'ဥပမာ - အမ်းငွေအကြွေ ထပ်ဖြည့်ခြင်း')
                        : t('e.g., Drinking water / delivery fee', 'ဥပမာ - သောက်ရေဖိုး / ပို့ဆောင်ခပေးချေခြင်း')
                    }
                  />
                </div>
                <div className="shift-form-actions">
                  <button
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => {
                      setMovementMode(null);
                      setMovementAmount('');
                      setMovementReason('');
                    }}
                    disabled={saving}
                  >
                    {t('cancel')}
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={submitCashMovement}
                    disabled={saving}
                  >
                    {saving ? t('Saving...', 'သိမ်းဆည်းနေသည်...') : t('confirm')}
                  </button>
                </div>
              </div>
            )}

            <div className="shift-reconciliation-note">
              <span>{t('Count the cash in the drawer before closing. Expected cash includes opening cash, cash sales, refunds, paid-in and paid-out movements.', 'အလုပ်ချိန်မပိတ်မီ ငွေသေတ္တာအတွင်းရှိ ငွေကို ရေတွက်ပါ။ မျှော်မှန်းငွေတွင် အဖွင့်ငွေ၊ လက်ငင်းငွေအရောင်း၊ ပြန်အမ်းငွေ၊ ငွေဝင်နှင့် ငွေထုတ်များ ပါဝင်ပါသည်။')}</span>
            </div>

            {current.movements && current.movements.length > 0 && (
              <div style={{ marginTop: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
                <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-xs)', color: 'var(--text-secondary)' }}>
                  {t('Cash Drawer Activity', 'ငွေသေတ္တာ အဝင်/အထွက် မှတ်တမ်း')}
                </h4>
                <div className="table-container" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('time')}</th>
                        <th>{t('Type', 'အမျိုးအစား')}</th>
                        <th>{t('Reason', 'အကြောင်းပြချက်')}</th>
                        <th style={{ textAlign: 'right' }}>{t('amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...current.movements].reverse().map((m) => (
                        <tr key={m.id}>
                          <td style={{ fontSize: 'var(--text-xs)' }}>{formatDateTime(m.createdAt)}</td>
                          <td>
                            <span className={`badge ${m.type === 'REFUND' || m.type === 'VOID' || m.type === 'PAID_OUT' ? 'badge-danger' : 'badge-success'}`}>
                              {m.type}
                            </span>
                          </td>
                          <td style={{ fontSize: 'var(--text-xs)' }}>{m.reason || '—'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {m.type === 'PAID_OUT' ? `−${formatCurrency(Math.abs(m.amount))}` : formatCurrency(m.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {showCloseForm ? (
              <div className="shift-close-form">
                <div className="input-group">
                  <label className="input-label" htmlFor="actual-cash">{t('Actual cash counted', 'ရေတွက်ထားသော အမှန်တကယ်ငွေ')}</label>
                  <input id="actual-cash" className="input" type="number" min="0" step="0.01" value={actualCash} onChange={(event) => setActualCash(event.target.value)} autoFocus />
                  {variancePreview !== null && (
                    <span className={`shift-variance ${variancePreview === 0 ? 'is-even' : variancePreview > 0 ? 'is-over' : 'is-short'}`}>
                      {variancePreview === 0 ? t('balanced') : `${variancePreview > 0 ? '+' : ''}${formatCurrency(variancePreview)} ${variancePreview > 0 ? t('over') : t('short')}`}
                    </span>
                  )}
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="closing-notes">{t('Closing note (optional)', 'အပိတ်မှတ်ချက် (ရွေးချယ်ရန်)')}</label>
                  <textarea id="closing-notes" className="input shift-notes" value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} maxLength={500} placeholder={t('Explain any difference…', 'ငွေကွာဟမှုရှိပါက အကြောင်းပြချက်ရေးပါ…')} />
                </div>
                <div className="shift-form-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => setShowCloseForm(false)} disabled={saving}>{t('cancel')}</button>
                  <button className="btn btn-primary" type="button" onClick={closeShift} disabled={saving}>{saving ? t('closingShift') : t('confirmCloseShift')}</button>
                </div>
              </div>
            ) : (
              <div className="shift-card-footer">
                <span className="shift-muted">{canCloseCurrent ? t('When your selling session ends, count the drawer and close this shift.', 'အရောင်းပြီးပါက ငွေသေတ္တာရှိ ငွေကို ရေတွက်ပြီး ဤအလုပ်ချိန်ကို ပိတ်ပါ။') : t('This shift belongs to another cashier.', 'ဤအလုပ်ချိန်သည် အခြားငွေကိုင်၏ အလုပ်ချိန်ဖြစ်ပါသည်။')}</span>
                {canCloseCurrent && <button className="btn btn-danger" type="button" onClick={() => { setMovementMode(null); setShowCloseForm(true); }}>{t('closeShift')}</button>}
              </div>
            )}
          </section>
        ) : (
          <section className="glass-card shift-open-card" aria-labelledby="open-shift-title">
            <div className="shift-open-icon" aria-hidden="true"><Banknote size={22} strokeWidth={1.75} /></div>
            <div>
              <h2 id="open-shift-title" className="heading-4">{t('openYourShift')}</h2>
              <p className="shift-muted">{t('A shift connects cash sales to your drawer and lets you reconcile the cash at closing.', 'အလုပ်ချိန်ဖွင့်ထားခြင်းဖြင့် လက်ငင်းငွေအရောင်းများကို သင့်ငွေသေတ္တာနှင့် ချိတ်ဆက်ပြီး အပိတ်တွင် ငွေစာရင်းကိုက်ညှိနိုင်ပါသည်။')}</p>
            </div>
            <div className="shift-open-form">
              <div className="input-group">
                <label className="input-label" htmlFor="opening-cash">{t('Opening cash', 'အဖွင့်ငွေ')}</label>
                <input id="opening-cash" className="input" type="number" min="0" step="0.01" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="opening-notes">{t('Note (optional)', 'မှတ်ချက် (ရွေးချယ်ရန်)')}</label>
                <input id="opening-notes" className="input" value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} maxLength={500} placeholder={t('Morning float, drawer number…', 'မနက်ခင်းအဖွင့်ငွေ၊ ငွေသေတ္တာနံပါတ်…')} />
              </div>
              <button className="btn btn-primary btn-lg" type="button" onClick={openShift} disabled={saving}>{saving ? t('openingShift') : t('openShift')}</button>
            </div>
          </section>
        )}

        <section className="glass-card shift-history-card" aria-labelledby="shift-history-title">
          <div className="shift-card-header">
            <div>
              <h2 id="shift-history-title" className="heading-4">{t('shiftHistory')}</h2>
              <p className="shift-muted">{isManager ? t('allCashierShifts') : t('recentShifts')}</p>
            </div>
            <span className="badge badge-neutral">{shifts.length}</span>
          </div>
          {shifts.length === 0 ? (
            <div className="empty-state shift-empty"><div className="empty-state-icon"><Clock size={26} strokeWidth={1.5} /></div><div className="empty-state-title">{t('noShiftHistory')}</div></div>
          ) : (
            <div className="table-container">
              <table className="table shift-table">
                <thead><tr><th>{t('cashier')}</th><th>{t('opened')}</th><th>{t('closed')}</th><th>{t('expectedCash')}</th><th>{t('actual')}</th><th>{t('variance')}</th><th>{t('statusLabel')}</th></tr></thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td><strong>{shift.user.name}</strong><small className="shift-table-email">{shift.user.email}</small></td>
                      <td>{formatDateTime(shift.openedAt)}</td>
                      <td>{shift.closedAt ? formatDateTime(shift.closedAt) : '—'}</td>
                      <td>{formatCurrency(shift.expectedCash)}</td>
                      <td>{shift.actualCash === null ? '—' : formatCurrency(shift.actualCash)}</td>
                      <td className={shift.variance === null ? '' : shift.variance === 0 ? 'text-success' : shift.variance > 0 ? 'text-warning' : 'text-danger'}>{shift.variance === null ? '—' : formatCurrency(shift.variance)}</td>
                      <td><span className={`badge ${shift.status === 'OPEN' ? 'badge-success' : 'badge-neutral'}`}>{shift.status === 'OPEN' ? t('openStatus') : t('closedStatus')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
