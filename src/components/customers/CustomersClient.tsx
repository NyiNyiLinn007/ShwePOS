'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';

/* ---------- Types ---------- */

interface RecentSale {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  createdAt: string | Date;
}

interface CustomerData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  totalPurchases: number;
  loyaltyPoints: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  purchaseCount: number;
  lastPurchaseDate: string | Date | null;
  recentSales: RecentSale[];
}

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
}

/* ---------- Constants ---------- */

const ITEMS_PER_PAGE = 12;

const emptyForm: CustomerFormData = {
  name: '',
  phone: '',
  email: '',
  address: '',
};

/* ---------- Component ---------- */

interface CustomersClientProps {
  initialCustomers: CustomerData[];
}

export function CustomersClient({ initialCustomers }: CustomersClientProps) {
  const { addToast } = useToast();
  const { language } = useAppStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);

  // State
  const [customers, setCustomers] = useState<CustomerData[]>(initialCustomers);
  // Sync when server re-renders with fresh data
  useEffect(() => { setCustomers(initialCustomers); }, [initialCustomers]);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerData | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CustomerData | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);

  // Filtered customers
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

  // Pagination
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

  /* ---- Modal handlers ---- */

  function openAddModal() {
    setEditingCustomer(null);
    setFormData(emptyForm);
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
    });
    setFormErrors({});
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData(emptyForm);
    setFormErrors({});
  }

  function handleFormChange(field: keyof CustomerFormData, value: string) {
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
    if (!formData.name.trim()) errors.name = t('Customer name is required', 'ဖောက်သည်အမည်ထည့်ရန်လိုပါသည်');

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
      addToast(t('Network error. Please try again.', '\u1000\u103d\u1014\u103a\u101b\u1000\u103a\u1001\u103b\u102d\u102f\u1037\u101a\u103d\u1004\u103a\u1038\u1001\u103b\u1000\u103a\u104b \u1011\u1015\u103a\u1000\u103c\u102d\u102f\u1038\u1005\u102c\u1038\u1015\u102b\u104b'), 'error');
    } finally {
      setSaving(false);
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
      addToast(t('Network error. Please try again.', '\u1000\u103d\u1014\u103a\u101b\u1000\u103a\u1001\u103b\u102d\u102f\u1037\u101a\u103d\u1004\u103a\u1038\u1001\u103b\u1000\u103a\u104b \u1011\u1015\u103a\u1000\u103c\u102d\u102f\u1038\u1005\u102c\u1038\u1015\u102b\u104b'), 'error');
    } finally {
      setDeleting(false);
    }
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
          <h1 className="page-title">{t('Customers', 'ဖောက်သည်များ')}</h1>
          <p className="page-subtitle mm-text">{t('Customer Management', 'ဖောက်သည်စီမံခန့်ခွဲမှု')}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAddModal}>
            <span>＋</span>
            {t('Add Customer', 'ဖောက်သည်ထည့်ရန်')}
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="page-body">
        <div
          className="flex gap-md"
          style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}
        >
          <div style={{ flex: '1 1 300px', maxWidth: 400 }}>
            <input
              type="text"
              className="input input-search"
              placeholder={t('Search by name, phone, email...', 'အမည်၊ ဖုန်၊ အီးမေးလ်ဖြင့် ရှာပါ...')}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {filteredCustomers.length} {t('customer', 'ဖောက်သည်')}{language !== 'mm' && filteredCustomers.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Customers Table */}
        {filteredCustomers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-title">{t('No customers found', 'ဖောက်သည်မတွေ့ပါ')}</div>
            <div className="empty-state-text">
              {search
                ? t('Try adjusting your search criteria', 'ရှာဖွေမှုကို ပြန်ပြင်ကြည့်ပါ')
                : t('Add your first customer to get started', 'စတင်ရန် ပထမဖောက်သည်ကိုထည့်ပါ')}
            </div>
            {!search && (
              <button className="btn btn-primary" onClick={openAddModal}>
                <span>＋</span> {t('Add Customer', 'ဖောက်သည်ထည့်ရန်')}
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
                    <th>{t('Phone', 'ဖုန်')}</th>
                    <th>{t('Email', 'အီးမေးလ်')}</th>
                    <th>{t('Address', 'လိပ်စာ')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Total Purchases', 'စုစုပေါင်းဝယ်ယူမှု')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Loyalty Points', 'အမှတ်စု')}</th>
                    <th>{t('Last Purchase', 'နောက်ဆုံးဝယ်ယူမှု')}</th>
                    <th style={{ width: 130 }}>{t('Actions', 'လုပ်ဆောင်ချက်')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCustomers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div
                          style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }}
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          {customer.name}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {customer.purchaseCount} {t('order', 'မှာယ်')}{language !== 'mm' && customer.purchaseCount !== 1 ? 's' : ''}
                        </div>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>
                        {customer.phone || (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>
                        {customer.email || (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {customer.address || (
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
                        {formatCurrency(customer.totalPurchases)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-sm)',
                        }}
                      >
                        {customer.loyaltyPoints > 0 ? (
                          <span className="badge badge-primary">
                            ⭐ {customer.loyaltyPoints}
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
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setSelectedCustomer(customer)}
                            title={t('View details', 'အသေးစိတ်ကြည့်ရန်')}
                          >
                            👁️
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEditModal(customer)}
                            title={t('Edit customer', 'ဖောက်သည်ပြင်ဆင်ရန်')}
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDeleteTarget(customer)}
                            title={t('Delete customer', 'ဖောက်သည်ဖျက်ရန်')}
                            style={{ color: 'var(--danger)' }}
                          >
                            🗑️
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

      {/* Add/Edit Customer Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 520 }}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {editingCustomer ? t('Edit Customer', 'ဖောက်သည်ပြင်ဆင်ရန်') : t('Add Customer', 'ဖောက်သည်ထည့်ရန်')}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* Name */}
              <div className="input-group">
                <label className="input-label">{t('Name *', 'အမည် *')}</label>
                <input
                  type="text"
                  className={`input ${formErrors.name ? 'input-error' : ''}`}
                  placeholder={t('Customer name', 'ဖောက်သည်အမည်')}
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                />
                {formErrors.name && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {formErrors.name}
                  </span>
                )}
              </div>

              {/* Phone */}
              <div className="input-group">
                <label className="input-label">{t('Phone', 'ဖုန်')}</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="e.g. 09-123456789"
                  value={formData.phone}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
                />
              </div>

              {/* Email */}
              <div className="input-group">
                <label className="input-label">{t('Email', 'အီးမေးလ်')}</label>
                <input
                  type="email"
                  className={`input ${formErrors.email ? 'input-error' : ''}`}
                  placeholder="customer@email.com"
                  value={formData.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                />
                {formErrors.email && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {formErrors.email}
                  </span>
                )}
              </div>

              {/* Address */}
              <div className="input-group">
                <label className="input-label">{t('Address', 'လိပ်စာ')}</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Customer address"
                  value={formData.address}
                  onChange={(e) => handleFormChange('address', e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={closeModal}
                disabled={saving}
              >
                {t('Cancel', 'မလုပ်တော့ပါ')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? t('Saving...', 'သိမ်းနေသည်...')
                  : editingCustomer
                  ? t('Update Customer', 'ဖောက်သည်အချက်အလက်ပြင်ရန်')
                  : t('Create Customer', 'ဖောက်သည်ဖန်တီးရန်')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="modal-backdrop" onClick={() => setSelectedCustomer(null)}>
          <div
            className="modal modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">{t('Customer Details', 'ဖောက်သည်အသေးစိတ်')}</h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setSelectedCustomer(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* Customer Info */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-md)',
                  marginBottom: 'var(--space-lg)',
                  padding: 'var(--space-lg)',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-lg)',
                }}
              >
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('Name', 'အမည်')}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>
                    {selectedCustomer.name}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('Phone', 'ဖုန်')}
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                    {selectedCustomer.phone || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('Email', 'အီးမေးလ်')}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)' }}>
                    {selectedCustomer.email || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('Address', 'လိပ်စာ')}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)' }}>
                    {selectedCustomer.address || '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('Total Purchases', 'စုစုပေါင်းဝယ်ယူမှု')}
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                    {formatCurrency(selectedCustomer.totalPurchases)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('Loyalty Points', 'အမှတ်စု')}
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    ⭐ {selectedCustomer.loyaltyPoints}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('Customer Since', 'ဖောက်သည်ဖြစ်သည့်ရက်')}
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)' }}>
                    {formatDate(selectedCustomer.createdAt)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                    {t('Total Orders', 'စုစုပေါင်းမှာယ်ရည်')}
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {selectedCustomer.purchaseCount}
                  </div>
                </div>
              </div>

              {/* Purchase History */}
              <h3 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 'var(--space-sm)', color: 'var(--text-secondary)' }}>
                {t('Recent Purchase History', 'လတ်တလောဝယ်ယူမှုမှတ်တမ်း')}
              </h3>
              {selectedCustomer.recentSales.length === 0 ? (
                <div
                  style={{
                    padding: 'var(--space-xl)',
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {t('No purchases yet', 'ဝယ်ယူမှုမှတ်တမ်းမရှိသေးပါ')}
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('Invoice', 'ပြေစာ')}</th>
                        <th>{t('Date', 'ရက်စွဲ')}</th>
                        <th style={{ textAlign: 'right' }}>{t('Amount', 'ပမာဏ')}</th>
                        <th>{t('Status', 'အခြေအနေ')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCustomer.recentSales.map((sale) => (
                        <tr key={sale.id}>
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
                          <td
                            style={{
                              textAlign: 'right',
                              fontWeight: 600,
                              fontFamily: 'var(--font-mono)',
                              fontSize: 'var(--text-sm)',
                              color: 'var(--primary)',
                            }}
                          >
                            {formatCurrency(sale.totalAmount)}
                          </td>
                          <td>
                            <span className={`badge ${getStatusBadgeClass(sale.status)}`}>
                              {sale.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setSelectedCustomer(null);
                  openEditModal(selectedCustomer);
                }}
              >
                ✏️ {t('Edit', 'ပြင်ဆင်ရန်')}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => setSelectedCustomer(null)}
              >
                {t('Close', 'ပိတ်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="modal-backdrop"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 440 }}
          >
            <div className="modal-header">
              <h2 className="modal-title">{t('Delete Customer', 'ဖောက်သည်ဖျက်ရန်')}</h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setDeleteTarget(null)}
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
                {t('Are you sure you want to delete', 'ဖျက်လိုသည်မှာ သေချာပါသလား')}{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {deleteTarget.name}
                </strong>
                ?
              </p>
              {deleteTarget.purchaseCount > 0 && (
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
                  ⚠ {t(`This customer has ${deleteTarget.purchaseCount} purchase${deleteTarget.purchaseCount !== 1 ? 's' : ''}. Customers with purchase history cannot be deleted.`, `ဤဖောက်သည်တွင် ဝယ်ယူမှု ${deleteTarget.purchaseCount} ခုရှိပါသည်။ ဝယ်ယူမှုမှတ်တမ်းရှိသောဖောက်သည်ကို ဖျက်ပယ်မရပါ။`)}
                </div>
              )}
              {deleteTarget.purchaseCount === 0 && (
                <div
                  style={{
                    marginTop: 'var(--space-md)',
                    padding: 'var(--space-md)',
                    background: 'var(--danger-light)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--danger)',
                  }}
                >
                  ⚠ {t('This action cannot be undone.', 'ဤလုပ်ဆောင်ချက်ကို ပြန်ဖျက်မရပါ။')}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                {t('Cancel', 'မလုပ်တော့ပါ')}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={deleting || deleteTarget.purchaseCount > 0}
              >
                {deleting ? t('Deleting...', 'ဖျက်နေသည်...') : t('Delete', 'ဖျက်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
