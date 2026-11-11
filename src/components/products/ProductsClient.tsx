'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import {
  formatCurrency,
  formatDate,
  formatQuantity,
  getExpiryInfo,
  isFractionalUnit,
} from '@/lib/utils';
import {
  ProductMonogram,
  Plus,
  Package,
  AlertTriangle,
  Clock,
  Calendar,
  Barcode,
  Pencil,
  Trash2,
  X,
  Info,
} from '@/components/ui/Icons';
import {
  ProductFormModal,
  ProductFormInput,
  emptyProductForm,
  generateRandomSKU,
} from '@/components/products/ProductFormModal';
import { BarcodeStickerModal } from '@/components/products/BarcodeStickerModal';

/* ---------- Types ---------- */

interface CategoryRef {
  id: string;
  name: string;
  nameMm: string | null;
}

interface Product {
  id: string;
  name: string;
  nameMm: string | null;
  sku: string;
  barcode: string | null;
  categoryId: string;
  costPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  batchNumber?: string | null;
  expiryDate?: string | Date | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
  category: CategoryRef;
}

interface Category {
  id: string;
  name: string;
  nameMm: string | null;
  slug: string;
  isActive: boolean;
}

const ITEMS_PER_PAGE = 10;

interface ProductsClientProps {
  initialProducts: Product[];
  categories: Category[];
}

export function ProductsClient({ initialProducts, categories }: ProductsClientProps) {
  const { addToast } = useToast();
  const { language, t } = useI18n();

  const [products, setProducts] = useState<Product[]>(initialProducts);
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormInput>(emptyProductForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [labelTarget, setLabelTarget] = useState<Product | null>(null);

  const filteredProducts = useMemo(() => {
    let result = products;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.nameMm && p.nameMm.includes(search)) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode && p.barcode.toLowerCase().includes(q))
      );
    }

    if (categoryFilter) {
      result = result.filter((p) => p.categoryId === categoryFilter);
    }

    return result;
  }, [products, search, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setCurrentPage(1);
  }, []);

  const handleCategoryFilterChange = useCallback((value: string) => {
    setCategoryFilter(value);
    setCurrentPage(1);
  }, []);

  /* ---- Modal handlers ---- */

  function openAddModal() {
    setEditingProduct(null);
    setFormData({ ...emptyProductForm, sku: generateRandomSKU() });
    setFormErrors({});
    setShowModal(true);
  }

  function openEditModal(product: Product) {
    setEditingProduct(product);
    const expStr = product.expiryDate
      ? new Date(product.expiryDate).toISOString().slice(0, 10)
      : '';
    setFormData({
      name: product.name,
      nameMm: product.nameMm || '',
      sku: product.sku,
      barcode: product.barcode || '',
      categoryId: product.categoryId,
      costPrice: String(product.costPrice),
      sellingPrice: String(product.sellingPrice),
      stockQuantity: String(product.stockQuantity),
      lowStockThreshold: String(product.lowStockThreshold),
      unit: product.unit,
      batchNumber: product.batchNumber || '',
      expiryDate: expStr,
      imageUrl: product.imageUrl || '',
      isActive: product.isActive,
    });
    setFormErrors({});
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProduct(null);
    setFormData(emptyProductForm);
    setFormErrors({});
  }

  function handleFormChange(field: keyof ProductFormInput, value: string | boolean) {
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
    if (!formData.name.trim()) errors.name = 'Product name is required';
    if (!formData.sku.trim()) errors.sku = 'SKU is required';
    if (!formData.categoryId) errors.categoryId = 'Category is required';

    const cost = Number(formData.costPrice);
    const selling = Number(formData.sellingPrice);
    if (isNaN(cost) || cost < 0) errors.costPrice = 'Invalid cost price';
    if (isNaN(selling) || selling < 0) errors.sellingPrice = 'Invalid selling price';

    const fractional = isFractionalUnit(formData.unit);
    const stock = Number(formData.stockQuantity);
    if (isNaN(stock) || stock < 0 || (!fractional && !Number.isInteger(stock))) {
      errors.stockQuantity = fractional
        ? 'Stock must be a non-negative number'
        : 'Stock must be a non-negative integer';
    }

    const threshold = Number(formData.lowStockThreshold);
    if (isNaN(threshold) || threshold < 0 || (!fractional && !Number.isInteger(threshold))) {
      errors.lowStockThreshold = fractional
        ? 'Threshold must be a non-negative number'
        : 'Threshold must be a non-negative integer';
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
        nameMm: formData.nameMm.trim() || null,
        sku: formData.sku.trim(),
        barcode: formData.barcode.trim() || null,
        categoryId: formData.categoryId,
        costPrice: Number(formData.costPrice),
        sellingPrice: Number(formData.sellingPrice),
        stockQuantity: Number(formData.stockQuantity),
        lowStockThreshold: Number(formData.lowStockThreshold),
        unit: formData.unit,
        batchNumber: formData.batchNumber.trim() || null,
        expiryDate: formData.expiryDate ? formData.expiryDate : null,
        imageUrl: formData.imageUrl.trim() || null,
        isActive: formData.isActive,
      };

      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || t('Failed to save product', 'ကုန်ပစ္စည်းသိမ်းမရပါ'), 'error');
        return;
      }

      if (editingProduct) {
        setProducts((prev) =>
          prev.map((p) => (p.id === editingProduct.id ? data : p))
        );
        addToast(t('Product updated successfully', 'ကုန်ပစ္စည်းပြင်ဆင်ပြီးပါပြီ'), 'success');
      } else {
        setProducts((prev) => [data, ...prev]);
        addToast(t('Product created successfully', 'ကုန်ပစ္စည်းအသစ်ထည့်ပြီးပါပြီ'), 'success');
      }

      closeModal();
      useAppStore.getState().triggerLowStockRefresh();
    } catch {
      addToast(t('Network error. Please try again.', 'ကွန်ရက်ချို့ယွင်းချက်။ ထပ်ကြိုးစားပါ။'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/products/${deleteTarget.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || t('Failed to delete product', 'ကုန်ပစ္စည်းဖျက်မရပါ'), 'error');
        return;
      }

      setProducts((prev) =>
        prev.map((p) =>
          p.id === deleteTarget.id ? { ...p, isActive: false } : p
        )
      );
      addToast(t('Product deactivated successfully', 'ကုန်ပစ္စည်းရပ်ဆိုင်းပြီးပါပြီ'), 'success');
      useAppStore.getState().triggerLowStockRefresh();
      setDeleteTarget(null);
    } catch {
      addToast(t('Network error. Please try again.', 'ကွန်ရက်ချို့ယွင်းချက်။ ထပ်ကြိုးစားပါ။'), 'error');
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
          <h1 className="page-title">{t('Products', 'ကုန်ပစ္စည်းများ')}</h1>
          <p className="page-subtitle mm-text">{t('Product Management', 'ကုန်ပစ္စည်းစီမံခန့်ခွဲမှု')}</p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={openAddModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} strokeWidth={2} />
            {t('Add Product', 'ကုန်ပစ္စည်းထည့်ရန်')}
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
              placeholder={t('Search by name, SKU, barcode...', 'အမည်၊ SKU၊ ဘားကုဒ်ဖြင့် ရှာပါ...')}
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          <div style={{ minWidth: 200 }}>
            <select
              className="input"
              value={categoryFilter}
              onChange={(e) => handleCategoryFilterChange(e.target.value)}
            >
              <option value="">{t('All Categories', 'အမျိုးအစားအားလုံး')}</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
            {filteredProducts.length} {t('product', 'ခု')}{language !== 'mm' && filteredProducts.length !== 1 ? 's' : ''}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Package size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-title">{t('No products found', 'ကုန်ပစ္စည်းမတွေ့ပါ')}</div>
            <div className="empty-state-text">
              {search || categoryFilter
                ? t('Try adjusting your search or filter criteria', 'ရှာဖွေမှု သို့မဟုတ် စစ်ထုတ်မှုကို ပြန်ပြင်ကြည့်ပါ')
                : t('Create your first product to get started', 'စတင်ရန် ပထမကုန်ပစ္စည်းကိုဖန်တီးပါ')}
            </div>
            {!search && !categoryFilter && (
              <button
                className="btn btn-primary"
                onClick={openAddModal}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Plus size={16} strokeWidth={2} />
                {t('Add Product', 'ကုန်ပစ္စည်းထည့်ရန်')}
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: 52 }}></th>
                    <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                    <th>SKU</th>
                    <th>{t('Category', 'အမျိုးအစား')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Cost', 'ကုန်ကျစရိတ်')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Selling', 'ရောင်းဈေး')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Stock', 'ကုန်လက်ကျန်')}</th>
                    <th>{t('Status', 'အခြေအနေ')}</th>
                    <th style={{ width: 100 }}>{t('Actions', 'လုပ်ဆောင်ချက်')}</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedProducts.map((product) => {
                    const isLowStock =
                      product.stockQuantity <= product.lowStockThreshold;
                    const stockColor = isLowStock
                      ? 'var(--danger)'
                      : 'var(--success)';
                    const expiryInfo = getExpiryInfo(product.expiryDate);

                    return (
                      <tr key={product.id}>
                        <td>
                          {product.imageUrl ? (
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 'var(--radius-sm)',
                                background: 'var(--bg-tertiary)',
                                border: '1px solid var(--border-subtle)',
                                overflow: 'hidden',
                              }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={product.imageUrl}
                                alt={product.name}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                              />
                            </div>
                          ) : (
                            <ProductMonogram name={product.name} size={38} />
                          )}
                        </td>

                        <td>
                          <div>
                            <div style={{ fontWeight: 600, marginBottom: 2 }}>
                              {product.name}
                            </div>
                            {product.nameMm && (
                              <div
                                className="mm-text"
                                style={{
                                  fontSize: 'var(--text-xs)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {product.nameMm}
                              </div>
                            )}
                            <div className="flex gap-xs" style={{ marginTop: 2, flexWrap: 'wrap' }}>
                              {product.batchNumber && (
                                <span className="badge badge-neutral" style={{ fontSize: '10px' }}>
                                  Batch: {product.batchNumber}
                                </span>
                              )}
                              {expiryInfo && expiryInfo.status === 'expired' && (
                                <span className="badge badge-danger" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <AlertTriangle size={10} strokeWidth={2} />
                                  {t('Expired', 'သက်တမ်းကုန်')} ({formatDate(expiryInfo.date)})
                                </span>
                              )}
                              {expiryInfo && expiryInfo.status === 'expiring_soon' && (
                                <span className="badge badge-warning" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Clock size={10} strokeWidth={2} />
                                  {t('Exp', 'သက်တမ်း')}: {formatDate(expiryInfo.date)} ({expiryInfo.diffDays}d)
                                </span>
                              )}
                              {expiryInfo && expiryInfo.status === 'valid' && (
                                <span className="badge badge-neutral" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <Calendar size={10} strokeWidth={2} />
                                  {formatDate(expiryInfo.date)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

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
                            {product.sku}
                          </code>
                        </td>

                        <td>
                          <span className="badge badge-primary">
                            {product.category?.name || '—'}
                          </span>
                        </td>

                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                          {formatCurrency(product.costPrice)}
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
                          {formatCurrency(product.sellingPrice)}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <span
                            style={{
                              color: stockColor,
                              fontWeight: 600,
                              fontSize: 'var(--text-sm)',
                            }}
                          >
                            {formatQuantity(product.stockQuantity, product.unit)}
                          </span>
                          <span
                            style={{
                              color: 'var(--text-muted)',
                              fontSize: 'var(--text-xs)',
                              marginLeft: 4,
                            }}
                          >
                            {product.unit}
                          </span>
                        </td>

                        <td>
                          <span
                            className={`badge ${
                              product.isActive ? 'badge-success' : 'badge-neutral'
                            }`}
                          >
                            {product.isActive ? t('Active', 'အသုံးပြုနေ') : t('Inactive', 'ရပ်ဆိုင်းထား')}
                          </span>
                        </td>

                        <td>
                          <div className="table-actions">
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setLabelTarget(product)}
                              title={t('Print Barcode Labels', 'ဘားကုဒ်စတစ်ကာ ထုတ်ရန်')}
                            >
                              <Barcode size={15} strokeWidth={1.75} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEditModal(product)}
                              title={t('Edit product', 'ကုန်ပစ္စည်းပြင်ဆင်ရန်')}
                            >
                              <Pencil size={15} strokeWidth={1.75} />
                            </button>
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => setDeleteTarget(product)}
                              title={t('Delete product', 'ကုန်ပစ္စည်းဖျက်ရန်')}
                              style={{ color: 'var(--danger)' }}
                            >
                              <Trash2 size={15} strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      <ProductFormModal
        isOpen={showModal}
        isEditing={!!editingProduct}
        formData={formData}
        formErrors={formErrors}
        categories={categories}
        saving={saving}
        onChange={handleFormChange}
        onSave={handleSave}
        onClose={closeModal}
      />

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
              <h2 className="modal-title">{t('Deactivate Product', 'ကုန်ပစ္စည်းရပ်ဆိုင်းရန်')}</h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setDeleteTarget(null)}
              >
                <X size={16} strokeWidth={1.75} />
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
                {t('Are you sure you want to deactivate', 'ရပ်ဆိုင်းလိုသည်မှာ သေချာပါသလား')}{' '}
                <strong style={{ color: 'var(--text-primary)' }}>
                  {deleteTarget.name}
                </strong>
                ?
              </p>
              <div
                style={{
                  marginTop: 'var(--space-md)',
                  padding: 'var(--space-md)',
                  background: 'var(--info-light)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--info)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <Info size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  {t('The product will be set to inactive rather than permanently deleted to preserve sales history.', 'အရောင်းမှတ်တမ်းကိုထိန်းသိမ်းရန် ကုန်ပစ္စည်းကိုအပြီးတိုင်ဖျက်မည်မဟုတ်ဘဲ ရပ်ဆိုင်းထားမည်ဖြစ်ပါသည်။')}
                </span>
              </div>
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
                disabled={deleting}
              >
                {deleting ? t('Deactivating...', 'ရပ်ဆိုင်းနေသည်...') : t('Deactivate', 'ရပ်ဆိုင်းရန်')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BarcodeStickerModal
        product={labelTarget}
        onClose={() => setLabelTarget(null)}
      />
    </>
  );
}
