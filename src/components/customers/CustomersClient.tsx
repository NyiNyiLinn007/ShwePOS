'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Plus,
  Users,
  Star,
  CreditCard,
  Eye,
  Pencil,
  Trash2,
} from '@/components/ui/Icons';
import {
  CustomerData,
  CustomerFormInput,
  emptyCustomerForm,
  CustomerFormModal,
  CustomerDetailModal,
  CustomerRepayModal,
  CustomerDeleteModal,
} from '@/components/customers/CustomerModals';

const ITEMS_PER_PAGE = 12;

interface CustomersClientProps {
  initialCustomers: CustomerData[];
}

export function CustomersClient({ initialCustomers }: CustomersClientProps) {
  const { addToast } = useToast();
  const { language, t } = useI18n();

  const [customers, setCustomers] = useState<CustomerData[]>(initialCustomers);
  useEffect(() => {
    setCustomers(initialCustomers);
  }, [initialCustomers]);

  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
  const [formData, setFormData] = useState<CustomerFormInput>(emptyCustomerForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);

  // Debt Repayment Modal State
  const [repayTarget, setRepayTarget] = useState<CustomerData | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState<'CASH' | 'CARD' | 'MOBILE_BANKING'>('CASH');
  const [repayReference, setRepayReference] = useState('');
  const [repayNotes, setRepayNotes] = useState('');
  const [repaying, setRepaying] = useState(false);

  const filteredCustomers = useMemo(() => {
    if (!search.trim()) return customers;

    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(search)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [customers, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedCustomers = filteredCustomers.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  function openAddModal() {
    setEditingCustomer(null);
    setFormData(emptyCustomerForm);
    setFormErrors({});
    setShowModal(true);
  }

  function openEditModal(customer: CustomerData) {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      creditLimit: String(customer.creditLimit ?? 0),
    });
    setFormErrors({});
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData(emptyCustomerForm);
    setFormErrors({});
  }

  function handleFormChange(field: keyof CustomerFormInput, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!formData.name.trim()) {
      errors.name = t('Customer name is required', 'ဖောက်သည်အမည်ထည့်ရန်လိုပါသည်');
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = t('Invalid email address', 'အီးမေးလ်လိပ်စာမှားနေပါသည်');
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;
    setSaving(true);

    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        address: formData.address.trim() || null,
        creditLimit: Math.max(0, parseFloat(formData.creditLimit) || 0),
      };

      const url = editingCustomer
        ? `/api/customers/${editingCustomer.id}`
        : '/api/customers';
      const method = editingCustomer ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || t('Failed to save customer', 'ဖောက်သည်သိမ်းမရပါ'), 'error');
        return;
      }

      if (editingCustomer) {
        setCustomers((prev) =>
          prev.map((c) =>
            c.id === editingCustomer.id
              ? {
                  ...c,
                  name: data.name,
                  phone: data.phone,
                  email: data.email,
                  address: data.address,
                  creditLimit: data.creditLimit,
                  creditBalance: data.creditBalance,
                  updatedAt: data.updatedAt,
                }
              : c
          )
        );
        addToast(t('Customer updated successfully', 'ဖောက်သည်ပြင်ဆင်ပြီးပါပြီ'), 'success');
      } else {
        const newCustomer: CustomerData = {
          ...data,
          purchaseCount: 0,
          lastPurchaseDate: null,
          recentSales: [],
        };
        setCustomers((prev) => [newCustomer, ...prev]);
        addToast(t('Customer created successfully', 'ဖောက်သည်အသစ်ထည့်ပြီးပါပြီ'), 'success');
      }

      closeModal();
    } catch {
      addToast(
        t('Network error. Please try again.', 'ကွန်ရက်ချို့ယွင်းချက်။ ထပ်ကြိုးစားပါ။'),
        'error'
      );
    } finally {
      setSaving(false);
    }
  }

  function openRepayModal(customer: CustomerData) {
    setRepayTarget(customer);
    setRepayAmount(String(customer.creditBalance || 0));
    setRepayMethod('CASH');
    setRepayReference('');
    setRepayNotes('');
  }

  async function handleRepayDebt() {
    if (!repayTarget) return;
    const amt = parseFloat(repayAmount);
    if (!amt || amt <= 0) {
      addToast(
        t('Please enter a valid repayment amount', 'ပေးဆပ်မည့်ပမာဏ အမှန်ထည့်ပါ'),
        'error'
      );
      return;
    }

    setRepaying(true);
    try {
      const res = await fetch(`/api/customers/${repayTarget.id}/repay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amt,
          method: repayMethod,
          reference: repayReference.trim() || undefined,
          notes: repayNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(
          data.error || t('Failed to record repayment', 'အကြွေးဆပ်မှု မှတ်တမ်းတင်မရပါ'),
          'error'
        );
        return;
      }

      setCustomers((prev) =>
        prev.map((c) =>
          c.id === repayTarget.id ? { ...c, creditBalance: data.newCreditBalance } : c
        )
      );
      if (selectedCustomer?.id === repayTarget.id) {
        setSelectedCustomer((prev) =>
          prev ? { ...prev, creditBalance: data.newCreditBalance } : null
        );
      }

      addToast(
        t('Debt repayment recorded successfully', 'အကြွေးဆပ်မှု မှတ်တမ်းတင်ပြီးပါပြီ'),
        'success'
      );
      setRepayTarget(null);
    } catch {
      addToast(
        t('Network error. Please try again.', 'ကွန်ရက်ချို့ယွင်းချက်။ ထပ်ကြိုးစားပါ။'),
        'error'
      );
    } finally {
      setRepaying(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/customers/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || t('Failed to delete customer', 'ဖောက်သည်ဖျက်မရပါ'), 'error');
        return;
      }

      setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      addToast(t('Customer deleted successfully', 'ဖောက်သည်ဖျက်ပြီးပါပြီ'), 'success');
      setDeleteTarget(null);
    } catch {
      addToast(
        t('Network error. Please try again.', 'ကွန်ရက်ချို့ယွင်းချက်။ ထပ်ကြိုးစားပါ။'),
        'error'
      );
    } finally {
      setDeleting(false);
    }
  }

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

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Customers', 'ဖောက်သည်များ')}</h1>
          <p className="page-subtitle mm-text">
            {t('Customer Management', 'ဖောက်သည်စီမံခန့်ခွဲမှု')}
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={openAddModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} strokeWidth={2} />
            {t('Add Customer', 'ဖောက်သည်ထည့်ရန်')}
          </button>
        </div>
      </div>

      <div className="page-body">
        <div
          className="flex gap-md"
          style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}
        >
          <div style={{ flex: '1 1 300px', maxWidth: 400 }}>
            <input
              type="text"
              className="input input-search"
              placeholder={t('searchCustomerFields')}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {filteredCustomers.length} {t('customer', 'ဖောက်သည်')}
            {language !== 'mm' && filteredCustomers.length !== 1 ? 's' : ''}
          </div>
        </div>

        {filteredCustomers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Users size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-title">
              {t('No customers found', 'ဖောက်သည်မတွေ့ပါ')}
            </div>
            <div className="empty-state-text">
              {search
                ? t('Try adjusting your search criteria', 'ရှာဖွေမှုကို ပြန်ပြင်ကြည့်ပါ')
                : t('Add your first customer to get started', 'စတင်ရန် ပထမဖောက်သည်ကိုထည့်ပါ')}
            </div>
            {!search && (
              <button
                className="btn btn-primary"
                onClick={openAddModal}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={16} strokeWidth={2} />
                {t('Add Customer', 'ဖောက်သည်ထည့်ရန်')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Name', 'အမည်')}</th>
                    <th>{t('phone')}</th>
                    <th>{t('Address', 'လိပ်စာ')}</th>
                    <th style={{ textAlign: 'right' }}>
                      {t('Total Purchases', 'စုစုပေါင်းဝယ်ယူမှု')}
                    </th>
                    <th style={{ textAlign: 'right' }}>{t('Credit Due', 'ကြွေးကျန်')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Loyalty Points', 'အမှတ်စု')}</th>
                    <th>{t('Last Purchase', 'နောက်ဆုံးဝယ်ယူမှု')}</th>
                    <th style={{ width: 150 }}>{t('Actions', 'လုပ်ဆောင်ချက်')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div
                          style={{
                            fontWeight: 600,
                            cursor: 'pointer',
                            color: 'var(--primary)',
                          }}
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          {customer.name}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {customer.purchaseCount} {t('order')}
                          {language !== 'mm' && customer.purchaseCount !== 1 ? 's' : ''}
                        </div>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>
                        {customer.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td
                        style={{
                          fontSize: 'var(--text-sm)',
                          maxWidth: 180,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {customer.address || <span style={{ color: 'var(--text-muted)' }}>—</span>}
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
                        {formatCurrency(customer.totalPurchases)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-sm)',
                        }}
                      >
                        {(customer.creditBalance ?? 0) > 0 ? (
                          <span className="badge badge-danger">
                            {formatCurrency(customer.creditBalance ?? 0)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0 K</span>
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-sm)',
                        }}
                      >
                        {customer.loyaltyPoints > 0 ? (
                          <span
                            className="badge badge-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Star size={11} strokeWidth={1.75} />
                            {customer.loyaltyPoints}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0</span>
                        )}
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>
                        {customer.lastPurchaseDate ? (
                          formatDate(customer.lastPurchaseDate)
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>{t('Never', 'မရှိသေး')}</span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          {(customer.creditBalance ?? 0) > 0 && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => openRepayModal(customer)}
                              title={t('Repay Debt', 'အကြွေးဆပ်ရန်')}
                              style={{ color: 'var(--warning)' }}
                            >
                              <CreditCard size={15} strokeWidth={1.75} />
                            </button>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setSelectedCustomer(customer)}
                            title={t('View details', 'အသေးစိတ်ကြည့်ရန်')}
                          >
                            <Eye size={15} strokeWidth={1.75} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEditModal(customer)}
                            title={t('Edit customer', 'ဖောက်သည်ပြင်ဆင်ရန်')}
                          >
                            <Pencil size={15} strokeWidth={1.75} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDeleteTarget(customer)}
                            title={t('Delete customer', 'ဖောက်သည်ဖျက်ရန်')}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={15} strokeWidth={1.75} />
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

      <CustomerFormModal
        isOpen={showModal}
        isEditing={!!editingCustomer}
        formData={formData}
        formErrors={formErrors}
        saving={saving}
        onChange={handleFormChange}
        onSave={handleSave}
        onClose={closeModal}
      />

      <CustomerDetailModal
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        onEdit={openEditModal}
        onRepayDebt={openRepayModal}
      />

      <CustomerRepayModal
        customer={repayTarget}
        repayAmount={repayAmount}
        repayMethod={repayMethod}
        repayReference={repayReference}
        repayNotes={repayNotes}
        repaying={repaying}
        onChangeAmount={setRepayAmount}
        onChangeMethod={setRepayMethod}
        onChangeReference={setRepayReference}
        onChangeNotes={setRepayNotes}
        onSubmit={handleRepayDebt}
        onClose={() => setRepayTarget(null)}
      />

      <CustomerDeleteModal
        customer={deleteTarget}
        deleting={deleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
