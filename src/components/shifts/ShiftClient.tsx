'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDateTime } from '@/lib/utils';

interface ShiftSummary {
  cashSales: number;
  refunds: number;
  paidIn: number;
  paidOut: number;
  expectedCash: number;
  movementCount: number;
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
}

interface ShiftClientProps {
  userRole: string;
  userName: string;
}

export default function ShiftClient({ userRole, userName }: ShiftClientProps) {
  const { language } = useAppStore();
  const { addToast } = useToast();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);
  const [current, setCurrent] = useState<Shift | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [openingCash, setOpeningCash] = useState('0');
  const [openingNotes, setOpeningNotes] = useState('');
  const [actualCash, setActualCash] = useState('');
  const [closingNotes, setClosingNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCloseForm, setShowCloseForm] = useState(false);

  const isManager = userRole === 'ADMIN' || userRole === 'MANAGER';

  async function loadShifts() {
    setLoading(true);
    try {
      const response = await fetch('/api/shifts', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to load shifts');
      setCurrent(data.current ?? null);
      setShifts(data.shifts ?? []);
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to load shifts', 'error');
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
      if (!response.ok) throw new Error(data.error || 'Failed to open shift');
      addToast(t('Cashier shift opened', 'Cashier Shift ဖွင့်ပြီးပါပြီ'), 'success');
      setOpeningNotes('');
      await loadShifts();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to open shift', 'error');
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
      if (!response.ok) throw new Error(data.error || 'Failed to close shift');
      addToast(t('Cashier shift closed', 'Cashier Shift ပိတ်ပြီးပါပြီ'), 'success');
      setShowCloseForm(false);
      setClosingNotes('');
      await loadShifts();
    } catch (error) {
      addToast(error instanceof Error ? error.message : 'Failed to close shift', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-title-group">
          <h1 className={`page-title${language === 'mm' ? ' mm-text' : ''}`}>
            {t('Cashier Shift', 'Cashier Shift')}
          </h1>
          <p className={`page-subtitle${language === 'mm' ? ' mm-text' : ''}`}>
            {t('Open, reconcile, and close your cash drawer safely.', 'အဖွင့်ငွေ၊ ရောင်းရငွေနှင့် အပိတ်ငွေကို စစ်ဆေးစီမံပါ။')}
          </p>
        </div>
        <div className="page-actions">
          <span className="badge badge-neutral">{userName}</span>
          <Link className="btn btn-secondary" href="/pos">{t('Open POS', 'POS ဖွင့်ရန်')}</Link>
        </div>
      </div>

      <div className="page-body shift-page-body">
        {loading ? (
          <div className="loading-page"><div className="loading-spinner" /><span>Loading shift…</span></div>
        ) : current ? (
          <section className="glass-card shift-current-card" aria-labelledby="current-shift-title">
            <div className="shift-card-header">
              <div>
                <span className="badge badge-success">OPEN</span>
                <h2 id="current-shift-title" className="heading-4">{t('Current cash drawer', 'လက်ရှိ Cash Drawer')}</h2>
                <p className="shift-muted">{t('Opened', 'ဖွင့်ချိန်')}: {formatDateTime(current.openedAt)}</p>
              </div>
              <Link className="btn btn-primary" href="/pos">{t('Continue selling', 'အရောင်းဆက်လုပ်ရန်')}</Link>
            </div>

            <div className="shift-stat-grid">
              <div className="shift-stat"><span>{t('Opening cash', 'အဖွင့်ငွေ')}</span><strong>{formatCurrency(current.openingCash)}</strong></div>
              <div className="shift-stat"><span>{t('Cash sales', 'Cash အရောင်း')}</span><strong>{formatCurrency(current.summary.cashSales)}</strong></div>
              <div className="shift-stat"><span>{t('Expected cash', 'မျှော်မှန်းငွေ')}</span><strong>{formatCurrency(current.expectedCash)}</strong></div>
              <div className="shift-stat"><span>{t('Transactions', 'လုပ်ဆောင်ချက်')}</span><strong>{current.summary.movementCount}</strong></div>
            </div>

            <div className="shift-reconciliation-note">
              <span>{t('Count the cash in the drawer before closing. Expected cash includes opening cash, cash sales, refunds, paid-in and paid-out movements.', 'Shift မပိတ်ခင် Cash Drawer ထဲရှိငွေကို ရေတွက်ပါ။ မျှော်မှန်းငွေတွင် အဖွင့်ငွေ၊ Cash အရောင်း၊ Refund နှင့် ငွေဝင်/ငွေထွက်များ ပါဝင်ပါသည်။')}</span>
            </div>

            {showCloseForm ? (
              <div className="shift-close-form">
                <div className="input-group">
                  <label className="input-label" htmlFor="actual-cash">{t('Actual cash counted', 'ရေတွက်ထားသော အမှန်တကယ်ငွေ')}</label>
                  <input id="actual-cash" className="input" type="number" min="0" step="0.01" value={actualCash} onChange={(event) => setActualCash(event.target.value)} autoFocus />
                  {variancePreview !== null && (
                    <span className={`shift-variance ${variancePreview === 0 ? 'is-even' : variancePreview > 0 ? 'is-over' : 'is-short'}`}>
                      {variancePreview === 0 ? t('Balanced', 'ငွေကိုက်ညီ') : `${variancePreview > 0 ? '+' : ''}${formatCurrency(variancePreview)} ${variancePreview > 0 ? t('over', 'ပို') : t('short', 'လို')}`}
                    </span>
                  )}
                </div>
                <div className="input-group">
                  <label className="input-label" htmlFor="closing-notes">{t('Closing note (optional)', 'အပိတ်မှတ်ချက် (ရွေးချယ်ရန်)')}</label>
                  <textarea id="closing-notes" className="input shift-notes" value={closingNotes} onChange={(event) => setClosingNotes(event.target.value)} maxLength={500} placeholder={t('Explain any difference…', 'ငွေကွာဟမှုရှိပါက အကြောင်းပြချက်ရေးပါ…')} />
                </div>
                <div className="shift-form-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => setShowCloseForm(false)} disabled={saving}>{t('Cancel', 'မလုပ်တော့ပါ')}</button>
                  <button className="btn btn-primary" type="button" onClick={closeShift} disabled={saving}>{saving ? t('Closing…', 'ပိတ်နေသည်…') : t('Confirm close shift', 'Shift ပိတ်မည်')}</button>
                </div>
              </div>
            ) : (
              <div className="shift-card-footer">
                <span className="shift-muted">{canCloseCurrent ? t('When your selling session ends, count the drawer and close this shift.', 'အရောင်းပြီးပါက Drawer ငွေကိုရေတွက်ပြီး Shift ပိတ်ပါ။') : t('This shift belongs to another cashier.', 'ဤ Shift သည် အခြား Cashier ၏ Shift ဖြစ်ပါသည်။')}</span>
                {canCloseCurrent && <button className="btn btn-danger" type="button" onClick={() => setShowCloseForm(true)}>{t('Close shift', 'Shift ပိတ်ရန်')}</button>}
              </div>
            )}
          </section>
        ) : (
          <section className="glass-card shift-open-card" aria-labelledby="open-shift-title">
            <div className="shift-open-icon" aria-hidden="true">$</div>
            <div>
              <h2 id="open-shift-title" className="heading-4">{t('Open your cashier shift', 'Cashier Shift ဖွင့်ရန်')}</h2>
              <p className="shift-muted">{t('A shift connects cash sales to your drawer and lets you reconcile the cash at closing.', 'Shift ဖွင့်ထားမှ Cash အရောင်းများကို သင့် Drawer နှင့် ချိတ်ဆက်ပြီး အပိတ်တွင် ငွေစာရင်းစစ်နိုင်ပါသည်။')}</p>
            </div>
            <div className="shift-open-form">
              <div className="input-group">
                <label className="input-label" htmlFor="opening-cash">{t('Opening cash', 'အဖွင့်ငွေ')}</label>
                <input id="opening-cash" className="input" type="number" min="0" step="0.01" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} />
              </div>
              <div className="input-group">
                <label className="input-label" htmlFor="opening-notes">{t('Note (optional)', 'မှတ်ချက် (ရွေးချယ်ရန်)')}</label>
                <input id="opening-notes" className="input" value={openingNotes} onChange={(event) => setOpeningNotes(event.target.value)} maxLength={500} placeholder={t('Morning float, drawer number…', 'မနက်ခင်းအဖွင့်ငွေ၊ Drawer နံပါတ်…')} />
              </div>
              <button className="btn btn-primary btn-lg" type="button" onClick={openShift} disabled={saving}>{saving ? t('Opening…', 'ဖွင့်နေသည်…') : t('Open shift', 'Shift ဖွင့်ရန်')}</button>
            </div>
          </section>
        )}

        <section className="glass-card shift-history-card" aria-labelledby="shift-history-title">
          <div className="shift-card-header">
            <div>
              <h2 id="shift-history-title" className="heading-4">{t('Shift history', 'Shift မှတ်တမ်း')}</h2>
              <p className="shift-muted">{isManager ? t('All cashier shifts', 'Cashier အားလုံး၏ Shift များ') : t('Your recent shifts', 'သင့်လတ်တလော Shift များ')}</p>
            </div>
            <span className="badge badge-neutral">{shifts.length}</span>
          </div>
          {shifts.length === 0 ? (
            <div className="empty-state shift-empty"><div className="empty-state-icon">—</div><div className="empty-state-title">{t('No shift history yet', 'Shift မှတ်တမ်းမရှိသေးပါ')}</div></div>
          ) : (
            <div className="table-container">
              <table className="table shift-table">
                <thead><tr><th>{t('Cashier', 'Cashier')}</th><th>{t('Opened', 'ဖွင့်ချိန်')}</th><th>{t('Closed', 'ပိတ်ချိန်')}</th><th>{t('Expected', 'မျှော်မှန်း')}</th><th>{t('Actual', 'အမှန်')}</th><th>{t('Variance', 'ကွာဟမှု')}</th><th>{t('Status', 'အခြေအနေ')}</th></tr></thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.id}>
                      <td><strong>{shift.user.name}</strong><small className="shift-table-email">{shift.user.email}</small></td>
                      <td>{formatDateTime(shift.openedAt)}</td>
                      <td>{shift.closedAt ? formatDateTime(shift.closedAt) : '—'}</td>
                      <td>{formatCurrency(shift.expectedCash)}</td>
                      <td>{shift.actualCash === null ? '—' : formatCurrency(shift.actualCash)}</td>
                      <td className={shift.variance === null ? '' : shift.variance === 0 ? 'text-success' : shift.variance > 0 ? 'text-warning' : 'text-danger'}>{shift.variance === null ? '—' : formatCurrency(shift.variance)}</td>
                      <td><span className={`badge ${shift.status === 'OPEN' ? 'badge-success' : 'badge-neutral'}`}>{shift.status}</span></td>
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
