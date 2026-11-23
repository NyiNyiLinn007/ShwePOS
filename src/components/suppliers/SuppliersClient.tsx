'use client';

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency } from '@/lib/utils';
import {
  Truck,
  Plus,
  CreditCard,
  Eye,
  Pencil,
  Trash2,
} from '@/components/ui/Icons';
import {
  SupplierRecord,
  SupplierFormInput,
  emptySupplierForm,
  SupplierFormModal,
  SupplierRepayModal,
  SupplierDetailModal,
} from '@/components/suppliers/SupplierModals';

interface SuppliersClientProps {
  initialSuppliers: SupplierRecord[];
  userRole: string;
}

export function SuppliersClient({
  initialSuppliers,
  userRole,
}: SuppliersClientProps) {
  const { t } = useI18n();
  const { addToast } = useToast();

  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(initialSuppliers);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SupplierRecord | null>(null);
  const [formData, setFormData] = useState<SupplierFormInput>(emptySupplierForm);
  const [saving, setSaving] = useState(false);

  const [detailTarget, setDetailTarget] = useState<SupplierRecord | null>(null);
  const [repayTarget, setRepayTarget] = useState<SupplierRecord | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'MOBILE_BANKING'>('CASH');
  const [repayRef, setRepayRef] = useState('');
  const [repayNotes, setRepayNotes] = useState('');
  const [repaying, setRepaying] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(q)) ||
        (s.phone && s.phone.includes(search))
    );
  }, [suppliers, search]);

  const totalPayables = useMemo(
    () => suppliers.reduce((sum, s) => sum + (s.creditBalance || 0), 0),
    [suppliers]
  );

  function openAdd() {
    setEditing(null);
    setFormData(emptySupplierForm);
    setShowForm(true);
  }

  function openEdit(s: SupplierRecord) {
    setEditing(s);
    setFormData({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      notes: s.notes || '',
    });
    setShowForm(true);
  }

  function openRepay(s: SupplierRecord) {
    setRepayTarget(s);
    setRepayAmount(String(s.creditBalance || 0));
    setRepayMethod('CASH');
    setRepayRef('');
    setRepayNotes('');
  }

  async function handleSave() {
    if (!formData.name.trim()) {
      addToast(t('Supplier name is required', 'ပေးသွင်းသူအမည် ထည့်ပါ'), 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        contactPerson: formData.contactPerson.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        notes: formData.notes.trim() || null,
      };
      const url = editing ? `/api/suppliers/${editing.id}` : '/api/suppliers';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to save supplier', 'ပေးသွင်းသူ သိမ်းမရပါ'), 'error');
        return;
      }

      if (editing) {
        setSuppliers((prev) =>
          prev.map((s) => (s.id === editing.id ? { ...s, ...data } : s))
        );
        addToast(t('Supplier updated', 'ပေးသွင်းသူ ပြင်ဆင်ပြီးပါပြီ'), 'success');
      } else {
        setSuppliers((prev) => [data, ...prev]);
        addToast(t('Supplier added', 'ပေးသွင်းသူအသစ် ထည့်ပြီးပါပြီ'), 'success');
      }
      setShowForm(false);
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRepay() {
    if (!repayTarget) return;
    const amt = parseFloat(repayAmount);
    if (!amt || amt <= 0) {
      addToast(t('Enter a valid amount', 'ပမာဏအမှန်ထည့်ပါ'), 'error');
      return;
    }
    setRepaying(true);
    try {
      const res = await fetch(`/api/suppliers/${repayTarget.id}/repay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          method: repayMethod,
          reference: repayRef.trim() || null,
          notes: repayNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to record payment', 'ငွေပေးချေမှု မှတ်တမ်းတင်မရပါ'), 'error');
        return;
      }
      setSuppliers((prev) =>
        prev.map((s) =>
          s.id === repayTarget.id
            ? {
                ...s,
                creditBalance: data.newCreditBalance,
                payments: [data.payment, ...(s.payments || [])],
              }
            : s
        )
      );
      addToast(t('Supplier payment recorded', 'ပေးသွင်းသူသို့ ငွေပေးချေမှု မှတ်တမ်းတင်ပြီးပါပြီ'), 'success');
      setRepayTarget(null);
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    } finally {
      setRepaying(false);
    }
  }

  async function handleDeactivate(supplier: SupplierRecord) {
    if (!window.confirm(t(`Deactivate supplier "${supplier.name}"?`, `"${supplier.name}" ကို ရပ်ဆိုင်းလိုပါသလား?`))) {
      return;
    }
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to deactivate supplier', 'ရပ်ဆိုင်းမရပါ'), 'error');
        return;
      }
      setSuppliers((prev) => prev.filter((s) => s.id !== supplier.id));
      addToast(t('Supplier deactivated', 'ပေးသွင်းသူ ရပ်ဆိုင်းပြီးပါပြီ'), 'success');
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Suppliers', 'ပေးသွင်းသူများ')}</h1>
          <p className="page-subtitle mm-text">
            {t('Vendor Directory & Accounts Payable', 'ပေးသွင်းသူစာရင်းနှင့် ပေးရန်ကျန်အကြွေးစီမံခန့်ခွဲမှု')}
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={openAdd}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} strokeWidth={2} />
            {t('Add Supplier', 'ပေးသွင်းသူထည့်ရန်')}
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="flex gap-md" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
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
              {t('Active Suppliers', 'လက်ရှိပေးသွင်းသူ')}
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{suppliers.length}</div>
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
              {t('Total Accounts Payable', 'ပေးရန်ကျန် စုစုပေါင်း')}
            </div>
            <div
              style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 700,
                color: totalPayables > 0 ? 'var(--danger)' : 'var(--success)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {formatCurrency(totalPayables)}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-lg)', maxWidth: 400 }}>
          <input
            type="text"
            className="input input-search"
            placeholder={t('Search supplier by name, contact, phone...', 'ပေးသွင်းသူအမည်၊ ဖုန်းဖြင့် ရှာပါ...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Truck size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-title">{t('No suppliers found', 'ပေးသွင်းသူ မတွေ့ပါ')}</div>
            <div className="empty-state-text">
              {t('Add your distributors and wholesalers to track purchase orders and payables', 'ကုန်အဝယ်မှတ်တမ်းနှင့် အကြွေးစာရင်းထိန်းရန် ပေးသွင်းသူများ ထည့်သွင်းပါ')}
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Supplier', 'ပေးသွင်းသူ')}</th>
                  <th>{t('Contact', 'ဆက်သွယ်သူ')}</th>
                  <th>{t('phone')}</th>
                  <th style={{ textAlign: 'center' }}>{t('Orders', 'အဝယ်အရေအတွက်')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Payable Due', 'ပေးရန်ကျန်ငွေ')}</th>
                  <th style={{ width: 150 }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                      {s.address && (
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {s.address}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{s.contactPerson || '—'}</td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{s.phone || '—'}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {s.purchaseOrderCount ?? 0}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {s.creditBalance > 0 ? (
                        <span className="badge badge-danger">{formatCurrency(s.creditBalance)}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>0 K</span>
                      )}
                    </td>
                    <td>
                      <div className="table-actions">
                        {s.creditBalance > 0 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => openRepay(s)}
                            title={t('Pay Supplier Debt', 'အကြွေးပေးချေရန်')}
                            style={{ color: 'var(--warning)' }}
                          >
                            <CreditCard size={15} strokeWidth={1.75} />
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDetailTarget(s)}
                          title={t('View History', 'မှတ်တမ်းကြည့်ရန်')}
                        >
                          <Eye size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEdit(s)}
                          title={t('edit')}
                        >
                          <Pencil size={15} strokeWidth={1.75} />
                        </button>
                        {userRole === 'ADMIN' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDeactivate(s)}
                            title={t('deactivate')}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={15} strokeWidth={1.75} />
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

      <SupplierFormModal
        isOpen={showForm}
        isEditing={!!editing}
        formData={formData}
        saving={saving}
        onChange={(f, v) => setFormData((prev) => ({ ...prev, [f]: v }))}
        onSave={handleSave}
        onClose={() => setShowForm(false)}
      />

      <SupplierDetailModal
        supplier={detailTarget}
        onClose={() => setDetailTarget(null)}
        onPay={openRepay}
      />

      <SupplierRepayModal
        supplier={repayTarget}
        amount={repayAmount}
        method={repayMethod}
        reference={repayRef}
        notes={repayNotes}
        submitting={repaying}
        onChangeAmount={setRepayAmount}
        onChangeMethod={setRepayMethod}
        onChangeReference={setRepayRef}
        onChangeNotes={setRepayNotes}
        onSubmit={handleRepay}
        onClose={() => setRepayTarget(null)}
      />
    </>
  );
}
