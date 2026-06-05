'use client';

import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { useToast } from '@/contexts/ToastContext';

interface Category {
  id: string;
  name: string;
  nameMm: string | null;
  description: string | null;
  slug: string;
  isActive: boolean;
  createdAt: string | Date;
  _count: {
    products: number;
  };
}

interface CategoryFormData {
  name: string;
  nameMm: string;
  description: string;
  slug: string;
  isActive: boolean;
}

const emptyForm: CategoryFormData = {
  name: '',
  nameMm: '',
  description: '',
  slug: '',
  isActive: true,
};

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface CategoriesClientProps {
  initialCategories: Category[];
}

export function CategoriesClient({ initialCategories }: CategoriesClientProps) {
  const { addToast } = useToast();
  const { language } = useAppStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [autoSlug, setAutoSlug] = useState(true);

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    const q = search.toLowerCase();
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.nameMm && c.nameMm.includes(search)) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [categories, search]);

  function openAddModal() {
    setEditingCategory(null);
    setFormData(emptyForm);
    setFormErrors({});
    setAutoSlug(true);
    setShowModal(true);
  }

  function openEditModal(category: Category) {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      nameMm: category.nameMm || '',
      description: category.description || '',
      slug: category.slug,
      isActive: category.isActive,
    });
    setFormErrors({});
    setAutoSlug(false);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingCategory(null);
    setFormData(emptyForm);
    setFormErrors({});
  }

  function handleFormChange(field: keyof CategoryFormData, value: string | boolean) {
    setFormData((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'name' && autoSlug && typeof value === 'string') {
        next.slug = slugify(value);
      }
      return next;
    });
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
    if (!formData.name.trim()) errors.name = t('Category name is required', 'အမျိုးအစားအမည်ထည့်ရန်လိုပါသည်');
    if (!formData.slug.trim()) errors.slug = t('Slug is required', 'Slug ထည့်ရန်လိုပါသည်');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSave() {
    if (!validateForm()) return;
    setSaving(true);

    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : '/api/categories';
      const method = editingCategory ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          nameMm: formData.nameMm.trim() || null,
          description: formData.description.trim() || null,
          slug: formData.slug.trim(),
          isActive: formData.isActive,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || t('Failed to save category', 'အမျိုးအစားသိမ်းမရပါ'), 'error');
        return;
      }

      if (editingCategory) {
        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategory.id ? data : c))
        );
        addToast(t('Category updated successfully', 'အမျိုးအစားပြင်ဆင်ပြီးပါပြီ'), 'success');
      } else {
        setCategories((prev) => [...prev, data]);
        addToast(t('Category created successfully', 'အမျိုးအစားအသစ်ထည့်ပြီးပါပြီ'), 'success');
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
      const res = await fetch(`/api/categories/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || t('Failed to delete category', 'အမျိုးအစားဖျက်မရပါ'), 'error');
        return;
      }

      setCategories((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      addToast(t('Category deleted successfully', 'အမျိုးအစားဖျက်ပြီးပါပြီ'), 'success');
      setDeleteTarget(null);
    } catch {
      addToast(t('Network error. Please try again.', '\u1000\u103d\u1014\u103a\u101b\u1000\u103a\u1001\u103b\u102d\u102f\u1037\u101a\u103d\u1004\u103a\u1038\u1001\u103b\u1000\u103a\u104b \u1011\u1015\u103a\u1000\u103c\u102d\u102f\u1038\u1005\u102c\u1038\u1015\u102b\u104b'), 'error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Categories', 'အမျိုးအစားများ')}</h1>
          <p className="page-subtitle mm-text">{t('Category Management', 'အမျိုးအစားစီမံခန့်ခွဲမှု')}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={openAddModal}>
            <span>＋</span>
            {t('Add Category', 'အမျိုးအစားထည့်ရန်')}
          </button>
        </div>
      </div>

      {/* Page Body */}
      <div className="page-body">
        {/* Search */}
        <div style={{ marginBottom: 'var(--space-lg)', maxWidth: 400 }}>
          <input
            type="text"
            className="input input-search"
            placeholder={t('Search categories...', 'အမျိုးအစားရှာပါ...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Categories Grid */}
        {filteredCategories.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <div className="empty-state-title">{t('No categories found', 'အမျိုးအစားမတွေ့ပါ')}</div>
            <div className="empty-state-text">
              {search
                ? t('Try a different search term', 'အခြားရှာဖွေချက်ဖြင့် ရှာကြည့်ပါ')
                : t('Create your first category to get started', 'စတင်ရန် ပထမအမျိုးအစားကိုဖန်တီးပါ')}
            </div>
            {!search && (
              <button className="btn btn-primary" onClick={openAddModal}>
                <span>＋</span> {t('Add Category', 'အမျိုးအစားထည့်ရန်')}
              </button>
            )}
          </div>
        ) : (
          <div className="grid-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
            {filteredCategories.map((category) => (
              <div key={category.id} className="glass-card" style={{ padding: 'var(--space-lg)' }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 'var(--space-md)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 2 }}>
                      {category.name}
                    </h3>
                    {category.nameMm && (
                      <p className="mm-text" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                        {category.nameMm}
                      </p>
                    )}
                  </div>
                  <span className={`badge ${category.isActive ? 'badge-success' : 'badge-neutral'}`}>
                    {category.isActive ? t('Active', 'အသုံးပြုနေ') : t('Inactive', 'ရပ်ဆိုင်းထား')}
                  </span>
                </div>

                {category.description && (
                  <p style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-muted)',
                    marginBottom: 'var(--space-md)',
                    lineHeight: 1.5,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {category.description}
                  </p>
                )}

                <div className="flex items-center justify-between" style={{ marginTop: 'auto' }}>
                  <div style={{
                    fontSize: 'var(--text-sm)',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-xs)',
                  }}>
                    <span>📦</span>
                    <span>{category._count.products} {t('product', 'ခု')}{language !== 'mm' && category._count.products !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="table-actions">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => openEditModal(category)}
                      title={t('Edit', 'ပြင်ဆင်ရန်')}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setDeleteTarget(category)}
                      title={t('Delete', 'ဖျက်ရန်')}
                      style={{ color: 'var(--danger)' }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingCategory ? t('Edit Category', 'အမျိုးအစားပြင်ဆင်ရန်') : t('Add Category', 'အမျိုးအစားထည့်ရန်')}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
                {/* Name EN */}
                <div className="input-group">
                  <label className="input-label">{t('Name (English) *', 'အမည် (အင်္ဂလိပ်) *')}</label>
                  <input
                    type="text"
                    className={`input ${formErrors.name ? 'input-error' : ''}`}
                    placeholder="e.g. Beverages"
                    value={formData.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                  />
                  {formErrors.name && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                      {formErrors.name}
                    </span>
                  )}
                </div>

                {/* Name MM */}
                <div className="input-group">
                  <label className="input-label">{t('Name (Myanmar)', 'အမည် (မြန်မာ)')}</label>
                  <input
                    type="text"
                    className="input mm-text"
                    placeholder="e.g. အဖျော်ယမကာများ"
                    value={formData.nameMm}
                    onChange={(e) => handleFormChange('nameMm', e.target.value)}
                  />
                </div>

                {/* Slug */}
                <div className="input-group">
                  <label className="input-label">
                    Slug *
                    {!editingCategory && (
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          marginLeft: 'var(--space-sm)',
                          cursor: 'pointer',
                        }}
                        onClick={() => setAutoSlug(!autoSlug)}
                      >
                        ({autoSlug ? 'auto' : 'manual'})
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    className={`input ${formErrors.slug ? 'input-error' : ''}`}
                    placeholder="e.g. beverages"
                    value={formData.slug}
                    onChange={(e) => {
                      setAutoSlug(false);
                      handleFormChange('slug', e.target.value);
                    }}
                  />
                  {formErrors.slug && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                      {formErrors.slug}
                    </span>
                  )}
                </div>

                {/* Description */}
                <div className="input-group">
                  <label className="input-label">{t('Description', 'ဖော်ပြချက်')}</label>
                  <textarea
                    className="input"
                    placeholder={t('Optional description...', 'ဖော်ပြချက် (ရွေးချယ်)...')}
                    rows={3}
                    value={formData.description}
                    onChange={(e) => handleFormChange('description', e.target.value)}
                    style={{ minHeight: 80 }}
                  />
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-md">
                  <label
                    className="input-label"
                    style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => handleFormChange('isActive', e.target.checked)}
                      style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                    />
                    {t('Active', 'အသုံးပြုနေ')}
                  </label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>
                {t('Cancel', 'မလုပ်တော့ပါ')}
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? t('Saving...', 'သိမ်းနေသည်...') : editingCategory ? t('Update', 'ပြင်ဆင်ရန်') : t('Create', 'ဖန်တီးရန်')}
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
              <h2 className="modal-title">{t('Delete Category', 'အမျိုးအစားဖျက်ရန်')}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteTarget(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {t('Are you sure you want to delete', 'ဖျက်လိုသည်မှာ သေချာပါသလား')} <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget.name}</strong>?
              </p>
              {deleteTarget._count.products > 0 && (
                <div style={{
                  marginTop: 'var(--space-md)',
                  padding: 'var(--space-md)',
                  background: 'var(--warning-light)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--warning)',
                }}>
                  ⚠ {t(`This category has ${deleteTarget._count.products} product(s). You must reassign them before deleting.`, `ဤအမျိုးအစားတွင် ကုန်ပစ္စည်း ${deleteTarget._count.products} ခုရှိပါသည်။ ဖျက်မပယ်မီ အခြားအမျိုးအစားသို့ပြောင်းပါ။`)}
                </div>
              )}
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 'var(--space-md)' }}>
                {t('This action cannot be undone.', 'ဤလုပ်ဆောင်ချက်ကို ပြန်ဖျက်မရပါ။')}
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                {t('Cancel', 'မလုပ်တော့ပါ')}
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? t('Deleting...', 'ဖျက်နေသည်...') : t('Delete', 'ဖျက်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
