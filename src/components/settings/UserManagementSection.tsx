'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatDate } from '@/lib/utils';
import { Users, User, Plus, Pencil, Trash2, X } from '@/components/ui/Icons';

export interface UserRecord {
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

const ROLES = [{ value: 'ADMIN' }, { value: 'MANAGER' }, { value: 'CASHIER' }];

const emptyUserForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'CASHIER',
  phone: '',
  isActive: true,
};

interface UserManagementSectionProps {
  users: UserRecord[];
  setUsers: React.Dispatch<React.SetStateAction<UserRecord[]>>;
}

export function UserManagementSection({ users, setUsers }: UserManagementSectionProps) {
  const { t } = useI18n();
  const { addToast } = useToast();

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [userForm, setUserForm] = useState<UserFormData>(emptyUserForm);
  const [userFormErrors, setUserFormErrors] = useState<Record<string, string>>({});
  const [savingUser, setSavingUser] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  function openAddUser() {
    setEditingUser(null);
    setUserForm(emptyUserForm);
    setUserFormErrors({});
    setShowUserModal(true);
  }

  function openEditUser(user: UserRecord) {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      phone: user.phone || '',
      isActive: user.isActive,
    });
    setUserFormErrors({});
    setShowUserModal(true);
  }

  function closeUserModal() {
    setShowUserModal(false);
    setEditingUser(null);
    setUserForm(emptyUserForm);
    setUserFormErrors({});
  }

  function handleUserFormChange(field: keyof UserFormData, value: string | boolean) {
    setUserForm((prev) => ({ ...prev, [field]: value }));
    if (userFormErrors[field]) {
      setUserFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validateUserForm(): boolean {
    const errors: Record<string, string> = {};
    if (!userForm.name.trim()) errors.name = 'Name is required';
    if (!userForm.email.trim()) errors.email = 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (userForm.email && !emailRegex.test(userForm.email)) {
      errors.email = 'Invalid email format';
    }
    if (!editingUser && !userForm.password) {
      errors.password = 'Password is required for new users';
    }
    if (userForm.password && userForm.password.length > 0 && userForm.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    setUserFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSaveUser() {
    if (!validateUserForm()) return;
    setSavingUser(true);

    try {
      const payload: Record<string, unknown> = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        phone: userForm.phone.trim() || null,
        isActive: userForm.isActive,
      };
      if (userForm.password) {
        payload.password = userForm.password;
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
        addToast(data.error || t('saveUserFailed'), 'error');
        return;
      }

      if (editingUser) {
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? data : u)));
        addToast(t('User updated', 'အသုံးပြုသူအပ်ဒိတ်ပြီး'), 'success');
      } else {
        setUsers((prev) => [data, ...prev]);
        addToast(t('User created', 'အသုံးပြုသူအသစ်ဖန်တီးပြီး'), 'success');
      }

      closeUserModal();
    } catch {
      addToast(t('networkError'), 'error');
    } finally {
      setSavingUser(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserTarget) return;
    setDeletingUser(true);

    try {
      const res = await fetch(`/api/users/${deleteUserTarget.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || t('deactivateUserFailed'), 'error');
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === deleteUserTarget.id ? { ...u, isActive: false } : u))
      );
      addToast(t('userDeactivated'), 'success');
      setDeleteUserTarget(null);
    } catch {
      addToast(t('networkError'), 'error');
    } finally {
      setDeletingUser(false);
    }
  }

  function getRoleLabel(role: string): string {
    return t(role.toLowerCase());
  }

  function getRoleBadgeClass(role: string): string {
    if (role === 'ADMIN') return 'badge-primary';
    if (role === 'MANAGER') return 'badge-success';
    return 'badge-neutral';
  }

  return (
    <>
      <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 'var(--space-lg)',
          }}
        >
          <div>
            <h3 className="heading-4" style={{ marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Users size={18} strokeWidth={1.75} />
              {t('User Management', 'အသုံးပြုသူစီမံခန့်ခွဲရေး')}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Manage system users and roles', 'အသုံးပြုသူနှင့်ရာထူးများစီမံပါ')}
            </p>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={openAddUser}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={15} strokeWidth={2} />
            {t('Add User', 'အသုံးပြုသူထည့်ရန်')}
          </button>
        </div>

        {users.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <User size={28} strokeWidth={1.5} />
            </div>
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
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'var(--bg-tertiary)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 700,
                            color: 'var(--primary)',
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
                      <span className={`badge ${user.isActive ? 'badge-success' : 'badge-neutral'}`}>
                        {user.isActive ? t('Active', 'အသုံးပြုနေဆဲ') : t('Inactive', 'ပိတ်ထားသည်')}
                      </span>
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                      {formatDate(user.createdAt)}
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => openEditUser(user)}
                          title={t('edit')}
                        >
                          <Pencil size={15} strokeWidth={1.75} />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDeleteUserTarget(user)}
                          title={t('deactivate')}
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
        )}
      </div>

      {showUserModal && (
        <div className="modal-backdrop" onClick={closeUserModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingUser ? t('Edit User', 'အသုံးပြုသူပြင်ဆင်ရန်') : t('Add User', 'အသုံးပြုသူထည့်ရန်')}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={closeUserModal}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label className="input-label">{t('Name', 'အမည်')} *</label>
                <input
                  type="text"
                  className={`input ${userFormErrors.name ? 'input-error' : ''}`}
                  placeholder={t('Full name', 'နာမည်အပြည့်အစုံ')}
                  value={userForm.name}
                  onChange={(e) => handleUserFormChange('name', e.target.value)}
                />
                {userFormErrors.name && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {userFormErrors.name}
                  </span>
                )}
              </div>

              <div className="input-group">
                <label className="input-label">{t('Email', 'အီးမေးလ်')} *</label>
                <input
                  type="email"
                  className={`input ${userFormErrors.email ? 'input-error' : ''}`}
                  placeholder="user@example.com"
                  value={userForm.email}
                  onChange={(e) => handleUserFormChange('email', e.target.value)}
                />
                {userFormErrors.email && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {userFormErrors.email}
                  </span>
                )}
              </div>

              <div className="input-group">
                <label className="input-label">
                  {t('Password', 'စကားဝှက်')} {editingUser ? '' : '*'}
                </label>
                <input
                  type="password"
                  className={`input ${userFormErrors.password ? 'input-error' : ''}`}
                  placeholder={
                    editingUser
                      ? t('Leave blank to keep current', 'လက်ရှိအတိုင်းထားရန် ဗလာထားပါ')
                      : t('Minimum 6 characters', 'အနည်းဆုံး ၆ လုံး')
                  }
                  value={userForm.password}
                  onChange={(e) => handleUserFormChange('password', e.target.value)}
                />
                {userFormErrors.password && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {userFormErrors.password}
                  </span>
                )}
              </div>

              <div className="input-group">
                <label className="input-label">{t('Role', 'ရာထူး')}</label>
                <select
                  className="input"
                  value={userForm.role}
                  onChange={(e) => handleUserFormChange('role', e.target.value)}
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {t(role.value.toLowerCase())}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label className="input-label">{t('phone')}</label>
                <input
                  type="text"
                  className="input"
                  placeholder="+95 9xxxxxxxx"
                  value={userForm.phone}
                  onChange={(e) => handleUserFormChange('phone', e.target.value)}
                />
              </div>

              <div className="input-group">
                <label
                  className="input-label"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={userForm.isActive}
                    onChange={(e) => handleUserFormChange('isActive', e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                  />
                  {t('Active', 'အသုံးပြုနေဆဲ')}
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeUserModal}>
                {t('Cancel', 'ပယ်ဖျက်ရန်')}
              </button>
              <button className="btn btn-primary" onClick={handleSaveUser} disabled={savingUser}>
                {savingUser
                  ? t('Saving...', 'သိမ်းနေသည်...')
                  : editingUser
                    ? t('Update User', 'အသုံးပြုသူအပ်ဒိတ်ရန်')
                    : t('Create User', 'အသုံးပြုသူဖန်တီးရန်')}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteUserTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteUserTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{t('Deactivate User', 'အသုံးပြုသူပိတ်ရန်')}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteUserTarget(null)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                {t(
                  'Are you sure you want to deactivate this user?',
                  'ဤအသုံးပြုသူကိုပိတ်ရန်သေချာပါသလား?'
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
                <div style={{ fontWeight: 600 }}>{deleteUserTarget.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  {deleteUserTarget.email} — {getRoleLabel(deleteUserTarget.role)}
                </div>
              </div>
              <p
                style={{
                  marginTop: 'var(--space-md)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-muted)',
                }}
              >
                {t(
                  'The user will be deactivated but their data will be preserved.',
                  'အသုံးပြုသူကိုပိတ်ထားမည်ဖြစ်သော်လည်း ၎င်းတို့၏ဒေတာကိုထိန်းသိမ်းထားမည်။'
                )}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteUserTarget(null)}>
                {t('Cancel', 'ပယ်ဖျက်ရန်')}
              </button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--danger)' }}
                onClick={handleDeleteUser}
                disabled={deletingUser}
              >
                {deletingUser
                  ? t('Deactivating...', 'ပိတ်နေသည်...')
                  : t('Deactivate', 'ပိတ်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
