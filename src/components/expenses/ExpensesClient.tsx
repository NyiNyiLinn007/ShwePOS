'use client';

import React, { useState, useMemo, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDate } from '@/lib/utils';
import { EXPENSE_CATEGORIES as SHARED_EXPENSE_CATEGORIES } from '@/lib/constants';

/* ---------- Types ---------- */

interface UserRef {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string | null;
  userId: string;
  date: string | Date;
  createdAt: string | Date;
  user: UserRef;
}

interface CategoryTotal {
  category: string;
  amount: number;
}

interface ExpenseSummary {
  totalAmount: number;
  categoryTotals: CategoryTotal[];
  count: number;
}

interface ExpenseFormData {
  category: string;
  amount: string;
  description: string;
  date: string;
  userId: string;
}

/* ---------- Constants ---------- */

const ITEMS_PER_PAGE = 10;

const EXPENSE_CATEGORIES = SHARED_EXPENSE_CATEGORIES.map((cat) => ({
  value: cat.value,
  en: cat.label,
  mm: cat.labelMm,
}));

const CATEGORY_COLORS: Record<string, string> = {
  Rent: '#D4A843',
  Utilities: '#3B82F6',
  Supplies: '#22C55E',
  Transport: '#F97316',
  Salary: '#A855F7',
  Marketing: '#EC4899',
  Maintenance: '#06B6D4',
  Food: '#F59E0B',
  Insurance: '#6366F1',
  Tax: '#DC2626',
  Other: '#64748B',
};

const emptyForm: ExpenseFormData = {
  category: 'Supplies',
  amount: '',
  description: '',
  date: new Date().toISOString().split('T')[0],
  userId: '',
};

/* ---------- Component ---------- */

interface ExpensesClientProps {
  initialExpenses: Expense[];
  users: UserRef[];
  initialSummary: ExpenseSummary;
}

export function ExpensesClient({
  initialExpenses,
  users,
  initialSummary,
}: ExpensesClientProps) {
  const { language } = useAppStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);
  const { addToast } = useToast();

  // State
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses);
  const [summary, setSummary] = useState<ExpenseSummary>(initialSummary);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState<ExpenseFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filtered & paginated
  const filteredExpenses = useMemo(() => {
    let result = expenses;
    if (categoryFilter) {
      result = result.filter((e) => e.category === categoryFilter);
    }
    if (dateFilter) {
      result = result.filter((e) => {
        const expDate = new Date(e.date).toISOString().split('T')[0];
        return expDate === dateFilter;
      });
    }
    return result;
  }, [expenses, categoryFilter, dateFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedExpenses = filteredExpenses.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const handleCategoryFilterChange = useCallback((value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  }, []);

  // Recalculate summary from current expenses state
  const recalcSummary = useCallback((expenseList: Expense[]) => {
    const categoryTotals: Record<string, number> = {};
    let totalAmount = 0;
    for (const exp of expenseList) {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
      totalAmount += exp.amount;
    }
    setSummary({
      totalAmount: Math.round(totalAmount),
      categoryTotals: Object.entries(categoryTotals).map(([category, amount]) => ({
        category,
        amount: Math.round(amount),
      })),
      count: expenseList.length,
    });
  }, []);

  // Monthly comparison data for chart
  const monthlyData = useMemo(() => {
    const monthMap = new Map<string, number>();
    for (const exp of expenses) {
      const d = new Date(exp.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap.set(key, (monthMap.get(key) || 0) + exp.amount);
    }
    return Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, amount]) => {
        const [year, m] = month.split('-');
        const date = new Date(Number(year), Number(m) - 1, 1);
        return {
          month: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
          amount: Math.round(amount),
        };
      });
  }, [expenses]);

  /* ---- Modal handlers ---- */

  function openAddModal() {
    setEditingExpense(null);
    setFormData({
      ...emptyForm,
      userId: users[0]?.id || '',
    });
    setFormErrors({});
    setShowModal(true);
  }

  function openEditModal(expense: Expense) {
    setEditingExpense(expense);
    setFormData({
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description || '',
      date: new Date(expense.date).toISOString().split('T')[0],
      userId: expense.userId,
    });
    setFormErrors({});
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingExpense(null);
    setFormData(emptyForm);
    setFormErrors({});
  }

  function handleFormChange(field: keyof ExpenseFormData, value: string) {
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
    if (!formData.category) errors.category = 'Category is required';
    const amount = Number(formData.amount);
    if (!formData.amount || isNaN(amount) || amount <= 0) {
      errors.amount = 'Amount must be a positive number';
    }
    if (!formData.date) errors.date = 'Date is required';
    if (!formData.userId) errors.userId = 'User is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;
    setSaving(true);

    try {
      const payload = {
        category: formData.category,
        amount: Number(formData.amount),
        description: formData.description.trim() || null,
        date: formData.date,
        userId: formData.userId,
      };

      const url = editingExpense
        ? `/api/expenses/${editingExpense.id}`
        : '/api/expenses';
      const method = editingExpense ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'Failed to save expense', 'error');
        return;
      }

      if (editingExpense) {
        const updated = expenses.map((e) =>
          e.id === editingExpense.id ? data : e
        );
        setExpenses(updated);
        recalcSummary(updated);
        addToast(t('Expense updated successfully', 'ကုန်ကျစရိတ်အောင်မြင်စွာပြင်ဆင်ပြီး'), 'success');
      } else {
        const updated = [data, ...expenses];
        setExpenses(updated);
        recalcSummary(updated);
        addToast(t('Expense added successfully', 'ကုန်ကျစရိတ်အောင်မြင်စွာထည့်ပြီး'), 'success');
      }

      closeModal();
    } catch {
      addToast('Network error. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/expenses/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'Failed to delete expense', 'error');
        return;
      }

      const updated = expenses.filter((e) => e.id !== deleteTarget.id);
      setExpenses(updated);
      recalcSummary(updated);
      addToast(t('Expense deleted successfully', 'ကုန်ကျစရိတ်အောင်မြင်စွာဖျက်ပြီး'), 'success');
      setDeleteTarget(null);
    } catch {
      addToast('Network error. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  }

  /* ---- Pagination ---- */

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

  function getCategoryLabel(value: string): string {
    const cat = EXPENSE_CATEGORIES.find((c) => c.value === value);
    if (!cat) return value;
    return language === 'mm' ? cat.mm : cat.en;
  }

  /* ---- Chart Tooltip ---- */

  function ExpenseTooltip({
    active,
    payload,
    label,
  }: {
    active?: boolean;
    payload?: Array<{ value: number }>;
    label?: string;
  }) {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div
        style={{
          background: 'var(--bg-primary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--space-sm) var(--space-md)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
          {label}
        </div>
        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--danger)' }}>
          {formatCurrency(payload[0].value)}
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Expenses', 'ကုန်ကျစရိတ်များ')}</h1>
          <p className="page-subtitle mm-text">
            {t('Track business expenses', 'လုပ်ငန်းကုန်ကျစရိတ်များခြေရာခံ')}
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAddModal}>
            <span>＋</span>
            {t('Add Expense', 'ကုန်ကျစရိတ်ထည့်ရန်')}
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* Summary Cards */}
        <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
          <div className="stat-card">
            <div
              className="stat-icon"
              style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}
            >
              💸
            </div>
            <div className="stat-content">
              <div className="stat-label">{t('Total Expenses', 'စုစုပေါင်းကုန်ကျစရိတ်')}</div>
              <div className="stat-value" style={{ color: 'var(--danger)' }}>
                {formatCurrency(summary.totalAmount)}
              </div>
            </div>
          </div>
          {summary.categoryTotals
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 3)
            .map((ct) => (
              <div key={ct.category} className="stat-card">
                <div
                  className="stat-icon"
                  style={{
                    background: `${CATEGORY_COLORS[ct.category] || '#64748B'}20`,
                    color: CATEGORY_COLORS[ct.category] || '#64748B',
                  }}
                >
                  {ct.category === 'Rent'
                    ? '🏠'
                    : ct.category === 'Utilities'
                      ? '💡'
                      : ct.category === 'Supplies'
                        ? '📦'
                        : ct.category === 'Transport'
                          ? '🚗'
                          : ct.category === 'Salary'
                            ? '👤'
                            : ct.category === 'Marketing'
                              ? '📣'
                              : ct.category === 'Maintenance'
                                ? '🔧'
                                : '📋'}
                </div>
                <div className="stat-content">
                  <div className="stat-label">{getCategoryLabel(ct.category)}</div>
                  <div className="stat-value" style={{ fontSize: 'var(--text-lg)' }}>
                    {formatCurrency(ct.amount)}
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Monthly Comparison Chart */}
        {monthlyData.length > 1 && (
          <div
            className="glass-card"
            style={{
              padding: 0,
              overflow: 'hidden',
              marginBottom: 'var(--space-xl)',
            }}
          >
            <div
              style={{
                padding: 'var(--space-lg)',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <h3 className="heading-4">
                {t('Monthly Expenses', 'လစဉ်ကုန်ကျစရိတ်')}
              </h3>
            </div>
            <div style={{ padding: 'var(--space-lg)', paddingTop: 'var(--space-md)' }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={monthlyData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#64748B', fontSize: 12 }}
                    tickFormatter={(v: number) =>
                      v >= 1000000
                        ? `${(v / 1000000).toFixed(1)}M`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(0)}K`
                          : String(v)
                    }
                    dx={-10}
                  />
                  <Tooltip content={<ExpenseTooltip />} />
                  <Bar
                    dataKey="amount"
                    fill="#EF4444"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                    opacity={0.85}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Filters Bar */}
        <div
          className="flex gap-md"
          style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}
        >
          <div style={{ minWidth: 200 }}>
            <select
              className="input"
              value={categoryFilter}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
            >
              <option value="">{t('All Categories', 'အမျိုးအစားအားလုံး')}</option>
              {EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {language === 'mm' ? cat.mm : cat.en}
                </option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="date"
              className="input"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{ width: 180 }}
            />
          </div>
          {(categoryFilter || dateFilter) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setCategoryFilter('');
                setDateFilter('');
                setCurrentPage(1);
              }}
            >
              {t('Clear Filters', 'စစ်ထုတ်မှုရှင်းရန်')}
            </button>
          )}
          <div
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              marginLeft: 'auto',
            }}
          >
            {filteredExpenses.length} {t('expense', 'ကုန်ကျစရိတ်')}
            {filteredExpenses.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Expenses Table */}
        {filteredExpenses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💸</div>
            <div className="empty-state-title">
              {t('No expenses found', 'ကုန်ကျစရိတ်ရှာမတွေ့ပါ')}
            </div>
            <div className="empty-state-text">
              {categoryFilter || dateFilter
                ? t(
                    'Try adjusting your filter criteria',
                    'စစ်ထုတ်မှုကိုပြင်ဆင်ကြည့်ပါ'
                  )
                : t(
                    'Record your first expense to get started',
                    'ကုန်ကျစရိတ်ပထမဆုံးမှတ်တမ်းတင်ပါ'
                  )}
            </div>
            {!categoryFilter && !dateFilter && (
              <button className="btn btn-primary" onClick={openAddModal}>
                <span>＋</span> {t('Add Expense', 'ကုန်ကျစရိတ်ထည့်ရန်')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Date', 'ရက်စွဲ')}</th>
                    <th>{t('Category', 'အမျိုးအစား')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Amount', 'ပမာဏ')}</th>
                    <th>{t('Description', 'ဖော်ပြချက်')}</th>
                    <th>{t('Recorded By', 'မှတ်တမ်းတင်သူ')}</th>
                    <th style={{ width: 100 }}>{t('Actions', 'လုပ်ဆောင်ချက်')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedExpenses.map((expense) => (
                    <tr key={expense.id}>
                      <td style={{ fontSize: 'var(--text-sm)', whiteSpace: 'nowrap' }}>
                        {formatDate(expense.date)}
                      </td>
                      <td>
                        <span
                          className="badge"
                          style={{
                            background: `${CATEGORY_COLORS[expense.category] || '#64748B'}20`,
                            color: CATEGORY_COLORS[expense.category] || '#64748B',
                            border: `1px solid ${CATEGORY_COLORS[expense.category] || '#64748B'}40`,
                          }}
                        >
                          {getCategoryLabel(expense.category)}
                        </span>
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 700,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--danger)',
                        }}
                      >
                        {formatCurrency(expense.amount)}
                      </td>
                      <td
                        style={{
                          fontSize: 'var(--text-sm)',
                          color: 'var(--text-secondary)',
                          maxWidth: 250,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {expense.description || '—'}
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>
                        {expense.user?.name || '—'}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEditModal(expense)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDeleteTarget(expense)}
                            title="Delete"
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

      {/* Add/Edit Expense Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingExpense
                  ? t('Edit Expense', 'ကုန်ကျစရိတ်ပြင်ဆင်ရန်')
                  : t('Add Expense', 'ကုန်ကျစရိတ်ထည့်ရန်')}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* Category */}
              <div className="input-group">
                <label className="input-label">
                  {t('Category', 'အမျိုးအစား')} *
                </label>
                <select
                  className={`input ${formErrors.category ? 'input-error' : ''}`}
                  value={formData.category}
                  onChange={(e) => handleFormChange('category', e.target.value)}
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {language === 'mm' ? cat.mm : cat.en}
                    </option>
                  ))}
                </select>
                {formErrors.category && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {formErrors.category}
                  </span>
                )}
              </div>

              {/* Amount */}
              <div className="input-group">
                <label className="input-label">
                  {t('Amount (K)', 'ပမာဏ (K)')} *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={`input ${formErrors.amount ? 'input-error' : ''}`}
                  placeholder="0"
                  value={formData.amount}
                  onChange={(e) => handleFormChange('amount', e.target.value)}
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
                {formErrors.amount && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {formErrors.amount}
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="input-group">
                <label className="input-label">
                  {t('Description', 'ဖော်ပြချက်')}
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder={t('Optional description', 'ဖော်ပြချက် (မလိုအပ်)')}
                  value={formData.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                />
              </div>

              {/* Date */}
              <div className="input-group">
                <label className="input-label">
                  {t('Date', 'ရက်စွဲ')} *
                </label>
                <input
                  type="date"
                  className={`input ${formErrors.date ? 'input-error' : ''}`}
                  value={formData.date}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                />
                {formErrors.date && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {formErrors.date}
                  </span>
                )}
              </div>

              {/* User */}
              <div className="input-group">
                <label className="input-label">
                  {t('Recorded By', 'မှတ်တမ်းတင်သူ')} *
                </label>
                <select
                  className={`input ${formErrors.userId ? 'input-error' : ''}`}
                  value={formData.userId}
                  onChange={(e) => handleFormChange('userId', e.target.value)}
                >
                  <option value="">{t('Select user', 'အသုံးပြုသူရွေးပါ')}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                {formErrors.userId && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {formErrors.userId}
                  </span>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal}>
                {t('Cancel', 'ပယ်ဖျက်ရန်')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving
                  ? t('Saving...', 'သိမ်းနေသည်...')
                  : editingExpense
                    ? t('Update', 'အပ်ဒိတ်လုပ်ရန်')
                    : t('Add Expense', 'ကုန်ကျစရိတ်ထည့်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {t('Delete Expense', 'ကုန်ကျစရိတ်ဖျက်ရန်')}
              </h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setDeleteTarget(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                {t(
                  'Are you sure you want to delete this expense?',
                  'ဤကုန်ကျစရိတ်ကိုဖျက်ရန်သေချာပါသလား?'
                )}
              </p>
              <div
                style={{
                  marginTop: 'var(--space-md)',
                  padding: 'var(--space-md)',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontWeight: 600 }}>
                  {getCategoryLabel(deleteTarget.category)} —{' '}
                  <span style={{ color: 'var(--danger)' }}>
                    {formatCurrency(deleteTarget.amount)}
                  </span>
                </div>
                {deleteTarget.description && (
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-muted)',
                      marginTop: 4,
                    }}
                  >
                    {deleteTarget.description}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
              >
                {t('Cancel', 'ပယ်ဖျက်ရန်')}
              </button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--danger)' }}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting
                  ? t('Deleting...', 'ဖျက်နေသည်...')
                  : t('Delete', 'ဖျက်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
