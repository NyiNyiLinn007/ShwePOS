'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/contexts/ToastContext';
import { formatDate } from '@/lib/utils';

/* ---------- Types ---------- */

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  phone: string;
  isActive: boolean;
}

const ROLES = [
  { value: 'ADMIN', en: 'Admin', mm: 'အက်ဒမင်' },
  { value: 'MANAGER', en: 'Manager', mm: 'မန်နေဂျာ' },
  { value: 'CASHIER', en: 'Cashier', mm: 'ငွေကိုင်' },
];

const emptyUserForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'CASHIER',
  phone: '',
  isActive: true,
};

export default function UsersPage() {
  const { language } = useAppStore();
  const { addToast } = useToast();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyUserForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch {
      addToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }

  function getRoleLabel(role: string): string {
    const r = ROLES.find((ro) => ro.value === role);
    if (!r) return role;
    return language === 'mm' ? r.mm : r.en;
  }

  function getRoleBadgeClass(role: string): string {
    if (role === 'ADMIN') return 'badge-primary';
    if (role === 'MANAGER') return 'badge-success';
    return 'badge-neutral';
  }

  function openAdd() {
    setEditingUser(null);
    setForm(emptyUserForm);
    setFormErrors({});
    setShowModal(true);
  }

  function openEdit(user: UserRecord) {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      phone: user.phone || '',
      isActive: user.isActive,
    });
    setFormErrors({});
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingUser(null);
    setForm(emptyUserForm);
    setFormErrors({});
  }

  function handleChange(field: keyof UserFormData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validate(): boolean {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (form.email && !emailRegex.test(form.email)) {
      errors.email = 'Invalid email format';
    }
    if (!editingUser && !form.password) {
      errors.password = 'Password is required for new users';
    }
    if (form.password && form.password.length > 0 && form.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);

    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        phone: form.phone.trim() || null,
        isActive: form.isActive,
      };
      if (form.password) {
        payload.password = form.password;
      }

      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'Failed to save user', 'error');
        return;
      }

      if (editingUser) {
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? data : u)));
        addToast(t('User updated', 'အသုံးပြုသူအပ်ဒိတ်ပြီး'), 'success');
      } else {
        setUsers((prev) => [data, ...prev]);
        addToast(t('User created', 'အသုံးပြုသူအသစ်ဖန်တီးပြီး'), 'success');
      }

      closeModal();
    } catch {
      addToast('Network error', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/users/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'Failed to deactivate user', 'error');
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === deleteTarget.id ? { ...u, isActive: false } : u
        )
      );
      addToast(t('User deactivated', 'အသုံးပြုသူပိတ်ထားပြီး'), 'success');
      setDeleteTarget(null);
    } catch {
      addToast('Network error', 'error');
    } finally {
      setDeleting(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const activeCount = users.filter((u) => u.isActive).length;

  if (loading) {
    return (
      <div className="loading-page" style={{ minHeight: '50vh' }}>
        <div className="loading-spinner" />
        <span>Loading users...</span>
      </div>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('User Management', 'အသုံးပြုသူစီမံခန့်ခွဲရေး')}</h1>
          <p className="page-subtitle mm-text">
            {t('Manage system users and their roles', 'အသုံးပြုသူနှင့်ရာထူးများစီမံပါ')}
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}>
          <span>＋</span> {t('Add User', 'အသုံးပြုသူထည့်ရန်')}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="page-body">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 'var(--space-md)',
            marginBottom: 'var(--space-xl)',
          }}
        >
          <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--primary)' }}>
              {users.length}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Total Users', 'စုစုပေါင်း')}
            </div>
          </div>
          <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--success)' }}>
              {activeCount}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Active', 'အသုံးပြုနေဆဲ')}
            </div>
          </div>
          <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--warning)' }}>
              {users.filter((u) => u.role === 'ADMIN').length}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Admins', 'အက်ဒမင်')}
            </div>
          </div>
          <div className="glass-card" style={{ textAlign: 'center', padding: 'var(--space-lg)' }}>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--info)' }}>
              {users.length - activeCount}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Inactive', 'ပိတ်ထားသည်')}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <input
              type="text"
              className="input"
              placeholder={t('Search users by name, email, or role...', 'အမည်၊ အီးမေးလ်၊ ရာထူးဖြင့်ရှာဖွေပါ...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ maxWidth: 400 }}
            />
          </div>

          {/* Users Table */}
          {filteredUsers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👤</div>
              <div className="empty-state-title">
                {t('No users found', 'အသုံးပြုသူမတွေ့ပါ')}
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Name', 'အမည်')}</th>
                    <th>{t('Email', 'အီးမေးလ်')}</th>
                    <th>{t('Role', 'ရာထူး')}</th>
                    <th>{t('Status', 'အခြေအနေ')}</th>
                    <th>{t('Created', 'ဖန်တီးသည့်ရက်')}</th>
                    <th style={{ width: 100 }}>{t('Actions', 'လုပ်ဆောင်ချက်')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              background: 'var(--bg-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              fontWeight: 700,
                              color: 'var(--primary)',
                              flexShrink: 0,
                            }}
                          >
                            {user.name
                              .split(' ')
                              .map((p) => p[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{user.name}</div>
                            {user.phone && (
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{user.email}</td>
                      <td>
                        <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${user.isActive ? 'badge-success' : 'badge-neutral'}`}
                        >
                          {user.isActive
                            ? t('Active', 'အသုံးပြုနေဆဲ')
                            : t('Inactive', 'ပိတ်ထားသည်')}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                        {formatDate(user.createdAt)}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEdit(user)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDeleteTarget(user)}
                            title="Deactivate"
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
          )}
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">
                {editingUser
                  ? t('Edit User', 'အသုံးပြုသူပြင်ဆင်ရန်')
                  : t('Add New User', 'အသုံးပြုသူအသစ်ထည့်ရန်')}
              </span>
              <button
                className="btn btn-ghost btn-icon"
                onClick={closeModal}
                type="button"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div
              className="modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}
            >
              <div className="input-group">
                <label className="input-label">{t('Name', 'အမည်')} *</label>
                <input
                  type="text"
                  className={`input ${formErrors.name ? 'input-error' : ''}`}
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder={t('Full name', 'အမည်အပြည့်အစုံ')}
                />
                {formErrors.name && (
                  <span style={{ color: 'var(--danger)', fontSize: 'var(--text-xs)' }}>
                    {formErrors.name}
                  </span>
                )}
              </div>
              <div className="input-group">
                <label className="input-label">{t('Email', 'အီးမေးလ်')} *</label>
                <input
                  type="email"
                  className={`input ${formErrors.email ? 'input-error' : ''}`}
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="user@shwepos.com"
                />
                {formErrors.email && (
                  <span style={{ color: 'var(--danger)', fontSize: 'var(--text-xs)' }}>
                    {formErrors.email}
                  </span>
                )}
              </div>
              <div className="input-group">
                <label className="input-label">
                  {t('Password', 'စကားဝှက်')} {editingUser ? '' : '*'}
                </label>
                <input
                  type="password"
                  className={`input ${formErrors.password ? 'input-error' : ''}`}
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder={
                    editingUser
                      ? t('Leave blank to keep current', 'မပြောင်းလိုပါက ဗလာထားပါ')
                      : t('Min 6 characters', 'အနည်းဆုံး ၆ လုံး')
                  }
                />
                {formErrors.password && (
                  <span style={{ color: 'var(--danger)', fontSize: 'var(--text-xs)' }}>
                    {formErrors.password}
                  </span>
                )}
              </div>
              <div className="input-group">
                <label className="input-label">{t('Role', 'ရာထူး')}</label>
                <select
                  className="input"
                  value={form.role}
                  onChange={(e) => handleChange('role', e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {language === 'mm' ? r.mm : r.en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">{t('Phone', 'ဖုန်းနံပါတ်')}</label>
                <input
                  type="text"
                  className="input"
                  value={form.phone}
                  onChange={(e) => handleChange('phone', e.target.value)}
                  placeholder="09-xxxxxxxxx"
                />
              </div>
              {editingUser && (
                <div className="input-group">
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-sm)',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => handleChange('isActive', e.target.checked)}
                    />
                    <span style={{ fontSize: 'var(--text-sm)' }}>
                      {t('Active', 'အသုံးပြုခွင့်ပေးရန်')}
                    </span>
                  </label>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                {t('Cancel', 'ပယ်ဖျက်ရန်')}
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving
                  ? t('Saving...', 'သိမ်းနေသည်...')
                  : editingUser
                  ? t('Update', 'အပ်ဒိတ်')
                  : t('Create', 'ဖန်တီးရန်')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <span className="modal-title">
                {t('Deactivate User', 'အသုံးပြုသူပိတ်ရန်')}
              </span>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setDeleteTarget(null)}
                type="button"
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                {t(
                  `Are you sure you want to deactivate "${deleteTarget.name}"? They will no longer be able to log in.`,
                  `"${deleteTarget.name}" ကို ပိတ်ထားလိုသည်မှာ သေချာပါသလား? ၎င်းသည် ဝင်ရောက်ခွင့်ရမည်မဟုတ်ပါ။`
                )}
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                {t('Cancel', 'ပယ်ဖျက်ရန်')}
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting
                  ? t('Deactivating...', 'ပိတ်နေသည်...')
                  : t('Deactivate', 'ပိတ်ထားရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
