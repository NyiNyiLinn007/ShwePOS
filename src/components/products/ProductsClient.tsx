'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDate, formatQuantity, isFractionalUnit } from '@/lib/utils';
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
  Upload,
  Printer,
  X,
  Info,
} from '@/components/ui/Icons';

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

interface ProductFormData {
  name: string;
  nameMm: string;
  sku: string;
  barcode: string;
  categoryId: string;
  costPrice: string;
  sellingPrice: string;
  stockQuantity: string;
  lowStockThreshold: string;
  unit: string;
  batchNumber: string;
  expiryDate: string;
  imageUrl: string;
  isActive: boolean;
}

/* ---------- Constants ---------- */

const ITEMS_PER_PAGE = 10;

const UNITS = [
  { value: 'pcs', label: 'Pieces (pcs)' },
  { value: 'kg', label: 'Kilogram (kg)' },
  { value: 'g', label: 'Gram (g)' },
  { value: 'liter', label: 'Liter (L)' },
  { value: 'ml', label: 'Milliliter (ml)' },
  { value: 'pack', label: 'Pack' },
  { value: 'box', label: 'Box' },
  { value: 'dozen', label: 'Dozen' },
  { value: 'set', label: 'Set' },
];

const emptyForm: ProductFormData = {
  name: '',
  nameMm: '',
  sku: '',
  barcode: '',
  categoryId: '',
  costPrice: '0',
  sellingPrice: '0',
  stockQuantity: '0',
  lowStockThreshold: '10',
  unit: 'pcs',
  batchNumber: '',
  expiryDate: '',
  imageUrl: '',
  isActive: true,
};

const CODE128_PATTERNS = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];

function buildCode128Bars(rawText: string): { x: number; w: number }[] {
  const clean = rawText.replace(/[^\x20-\x7E]/g, '') || '000000';
  const codes: number[] = [104]; // Start B
  let checksum = 104;
  for (let i = 0; i < clean.length; i++) {
    const val = clean.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(106); // Stop

  const bars: { x: number; w: number }[] = [];
  let cursor = 10; // Quiet zone
  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const width = Number(pattern[i]);
      if (i % 2 === 0) {
        bars.push({ x: cursor, w: width });
      }
      cursor += width;
    }
  }
  return bars;
}

function resizeImageToDataUrl(file: File, maxSize = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context unavailable'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function generateSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'PRD-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/* ---------- Component ---------- */

interface ProductsClientProps {
  initialProducts: Product[];
  categories: Category[];
}

export function ProductsClient({ initialProducts, categories }: ProductsClientProps) {
  const { addToast } = useToast();
  const { language, t } = useI18n();
  const businessName = useSettingsStore((s) => s.businessName);

  // State
  const [products, setProducts] = useState<Product[]>(initialProducts);
  // Sync when server re-renders with fresh data
  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Barcode Label Print State
  const [labelTarget, setLabelTarget] = useState<Product | null>(null);
  const [labelCount, setLabelCount] = useState(4);

  // Filtered & paginated products
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

  // Reset page when filters change
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
    setFormData({ ...emptyForm, sku: generateSKU() });
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
    setFormData(emptyForm);
    setFormErrors({});
  }

  function handleFormChange(field: keyof ProductFormData, value: string | boolean) {
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

      // Soft delete - update in list
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

        {/* Products Table */}
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

                    return (
                      <tr key={product.id}>
                        {/* Image / Monogram */}
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

                        {/* Name */}
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
                              {product.expiryDate && (() => {
                                const exp = new Date(product.expiryDate);
                                const diffDays = Math.ceil((exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                                if (diffDays < 0) {
                                  return (
                                    <span className="badge badge-danger" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                      <AlertTriangle size={10} strokeWidth={2} />
                                      {t('Expired', 'သက်တမ်းကုန်')} ({formatDate(exp)})
                                    </span>
                                  );
                                }
                                if (diffDays <= 30) {
                                  return (
                                    <span className="badge badge-warning" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                      <Clock size={10} strokeWidth={2} />
                                      {t('Exp', 'သက်တမ်း')}: {formatDate(exp)} ({diffDays}d)
                                    </span>
                                  );
                                }
                                return (
                                  <span className="badge badge-neutral" style={{ fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Calendar size={10} strokeWidth={2} />
                                    {formatDate(exp)}
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </td>

                        {/* SKU */}
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

                        {/* Category */}
                        <td>
                          <span className="badge badge-primary">
                            {product.category?.name || '—'}
                          </span>
                        </td>

                        {/* Cost Price */}
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                          {formatCurrency(product.costPrice)}
                        </td>

                        {/* Selling Price */}
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

                        {/* Stock */}
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

                        {/* Status */}
                        <td>
                          <span
                            className={`badge ${
                              product.isActive ? 'badge-success' : 'badge-neutral'
                            }`}
                          >
                            {product.isActive ? t('Active', 'အသုံးပြုနေ') : t('Inactive', 'ရပ်ဆိုင်းထား')}
                          </span>
                        </td>

                        {/* Actions */}
                        <td>
                          <div className="table-actions">
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => {
                                setLabelTarget(product);
                                setLabelCount(4);
                              }}
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

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div
            className="modal modal-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="modal-title">
                {editingProduct ? t('Edit Product', 'ကုန်ပစ္စည်းပြင်ဆင်ရန်') : t('Add Product', 'ကုန်ပစ္စည်းထည့်ရန်')}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={closeModal}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 'var(--space-md)',
                }}
              >
                {/* Name EN */}
                <div className="input-group">
                  <label className="input-label">{t('Name (English) *', 'အမည် (အင်္ဂလိပ်) *')}</label>
                  <input
                    type="text"
                    className={`input ${formErrors.name ? 'input-error' : ''}`}
                    placeholder="e.g. Coca Cola 330ml"
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
                    placeholder="မြန်မာအမည်"
                    value={formData.nameMm}
                    onChange={(e) => handleFormChange('nameMm', e.target.value)}
                  />
                </div>

                {/* SKU */}
                <div className="input-group">
                  <label className="input-label">
                    SKU *
                    {!editingProduct && (
                      <button
                        type="button"
                        style={{
                          marginLeft: 'var(--space-sm)',
                          fontSize: 'var(--text-xs)',
                          color: 'var(--primary)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                        onClick={() => handleFormChange('sku', generateSKU())}
                      >
                        Generate
                      </button>
                    )}
                  </label>
                  <input
                    type="text"
                    className={`input ${formErrors.sku ? 'input-error' : ''}`}
                    placeholder="e.g. PRD-ABC123"
                    value={formData.sku}
                    onChange={(e) => handleFormChange('sku', e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  {formErrors.sku && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                      {formErrors.sku}
                    </span>
                  )}
                </div>

                {/* Barcode */}
                <div className="input-group">
                  <label className="input-label">Barcode</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Optional barcode"
                    value={formData.barcode}
                    onChange={(e) => handleFormChange('barcode', e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                {/* Category */}
                <div className="input-group">
                  <label className="input-label">Category *</label>
                  <select
                    className={`input ${formErrors.categoryId ? 'input-error' : ''}`}
                    value={formData.categoryId}
                    onChange={(e) => handleFormChange('categoryId', e.target.value)}
                  >
                    <option value="">Select category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                        {cat.nameMm ? ` (${cat.nameMm})` : ''}
                      </option>
                    ))}
                  </select>
                  {formErrors.categoryId && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                      {formErrors.categoryId}
                    </span>
                  )}
                </div>

                {/* Unit */}
                <div className="input-group">
                  <label className="input-label">Unit</label>
                  <select
                    className="input"
                    value={formData.unit}
                    onChange={(e) => handleFormChange('unit', e.target.value)}
                  >
                    {UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Cost Price */}
                <div className="input-group">
                  <label className="input-label">Cost Price (K) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={`input ${formErrors.costPrice ? 'input-error' : ''}`}
                    placeholder="0"
                    value={formData.costPrice}
                    onChange={(e) => handleFormChange('costPrice', e.target.value)}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  {formErrors.costPrice && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                      {formErrors.costPrice}
                    </span>
                  )}
                </div>

                {/* Selling Price */}
                <div className="input-group">
                  <label className="input-label">Selling Price (K) *</label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    className={`input ${formErrors.sellingPrice ? 'input-error' : ''}`}
                    placeholder="0"
                    value={formData.sellingPrice}
                    onChange={(e) =>
                      handleFormChange('sellingPrice', e.target.value)
                    }
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  {formErrors.sellingPrice && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                      {formErrors.sellingPrice}
                    </span>
                  )}
                </div>

                {/* Stock Quantity */}
                <div className="input-group">
                  <label className="input-label">Stock Quantity ({formData.unit})</label>
                  <input
                    type="number"
                    min="0"
                    step={isFractionalUnit(formData.unit) ? '0.01' : '1'}
                    className={`input ${formErrors.stockQuantity ? 'input-error' : ''}`}
                    placeholder="0"
                    value={formData.stockQuantity}
                    onChange={(e) =>
                      handleFormChange('stockQuantity', e.target.value)
                    }
                  />
                  {formErrors.stockQuantity && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                      {formErrors.stockQuantity}
                    </span>
                  )}
                </div>

                {/* Low Stock Threshold */}
                <div className="input-group">
                  <label className="input-label">{t('Low Stock Threshold', 'ကုန်လက်ကျန်နည်းသတ်မှတ်ချက်')}</label>
                  <input
                    type="number"
                    min="0"
                    step={isFractionalUnit(formData.unit) ? '0.01' : '1'}
                    className={`input ${formErrors.lowStockThreshold ? 'input-error' : ''}`}
                    placeholder="10"
                    value={formData.lowStockThreshold}
                    onChange={(e) =>
                      handleFormChange('lowStockThreshold', e.target.value)
                    }
                  />
                  {formErrors.lowStockThreshold && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                      {formErrors.lowStockThreshold}
                    </span>
                  )}
                </div>

                {/* Batch Number */}
                <div className="input-group">
                  <label className="input-label">{t('Batch Number', 'အသုတ်နံပါတ် (Batch No.)')}</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Optional batch / lot number"
                    value={formData.batchNumber}
                    onChange={(e) => handleFormChange('batchNumber', e.target.value)}
                  />
                </div>

                {/* Expiry Date */}
                <div className="input-group">
                  <label className="input-label">{t('Expiry Date', 'သက်တမ်းကုန်ဆုံးရက်')}</label>
                  <input
                    type="date"
                    className="input"
                    value={formData.expiryDate}
                    onChange={(e) => handleFormChange('expiryDate', e.target.value)}
                  />
                </div>

                {/* Image Upload & URL - full width */}
                <div className="input-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="input-label">{t('Product Image (Upload or URL)', 'ကုန်ပစ္စည်းပုံ (ပုံတင်ရန် သို့မဟုတ် လင့်ခ်)')}</label>
                  <div className="flex gap-sm" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                    {formData.imageUrl && (
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          border: '1px solid var(--border-color)',
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={formData.imageUrl}
                          alt="Preview"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                    )}
                    <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Upload size={14} strokeWidth={1.75} />
                      {t('Upload Photo', 'ပုံရွေးရန်')}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const dataUrl = await resizeImageToDataUrl(file, 320);
                            handleFormChange('imageUrl', dataUrl);
                          } catch {
                            addToast(t('Failed to process image', 'ပုံဖတ်မရပါ'), 'error');
                          }
                        }}
                      />
                    </label>
                    <input
                      type="text"
                      className="input"
                      style={{ flex: 1, minWidth: 180 }}
                      placeholder="https://example.com/image.jpg (optional)"
                      value={formData.imageUrl.startsWith('data:') ? '' : formData.imageUrl}
                      onChange={(e) => handleFormChange('imageUrl', e.target.value)}
                    />
                    {formData.imageUrl && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleFormChange('imageUrl', '')}
                        style={{ color: 'var(--danger)' }}
                      >
                        <X size={14} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Active Toggle - full width */}
                <div
                  className="input-group"
                  style={{ gridColumn: '1 / -1' }}
                >
                  <label
                    className="input-label"
                    style={{
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-sm)',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) =>
                        handleFormChange('isActive', e.target.checked)
                      }
                      style={{
                        width: 18,
                        height: 18,
                        accentColor: 'var(--primary)',
                      }}
                    />
                    {t('Active Product', 'အသုံးပြုနေသောကုန်ပစ္စည်း')}
                  </label>
                </div>

                {/* Price margin info */}
                {Number(formData.costPrice) > 0 &&
                  Number(formData.sellingPrice) > 0 && (
                    <div
                      style={{
                        gridColumn: '1 / -1',
                        padding: 'var(--space-md)',
                        background: 'var(--primary-light)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: 'var(--text-sm)',
                        color: 'var(--primary)',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>
                        {t('Margin', 'အမြတ်')}:{' '}
                        {formatCurrency(
                          Number(formData.sellingPrice) -
                            Number(formData.costPrice)
                        )}
                      </span>
                      <span>
                        {t('Markup', 'တန်ဖိုးတင်')}:{' '}
                        {(
                          ((Number(formData.sellingPrice) -
                            Number(formData.costPrice)) /
                            Number(formData.costPrice)) *
                          100
                        ).toFixed(1)}
                        %
                      </span>
                    </div>
                  )}
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
                  : editingProduct
                  ? t('Update Product', 'ကုန်ပစ္စည်းအချက်အလက်ပြင်ရန်')
                  : t('Create Product', 'ကုန်ပစ္စည်းဖန်တီးရန်')}
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

      {/* Barcode Label Print Modal */}
      {labelTarget && (
        <div className="modal-backdrop" onClick={() => setLabelTarget(null)}>
          <div
            className="modal modal-lg"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 640 }}
          >
            <div className="modal-header no-print">
              <h2 className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Barcode size={18} strokeWidth={1.75} />
                {t('Print Barcode Labels', 'ဘားကုဒ်စတစ်ကာ ထုတ်ရန်')} — {labelTarget.name}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setLabelTarget(null)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              <div className="flex gap-md no-print" style={{ marginBottom: 'var(--space-md)', alignItems: 'center' }}>
                <label className="input-label" style={{ margin: 0 }}>
                  {t('Number of Stickers:', 'ထုတ်မည့် စတစ်ကာအရေအတွက် -')}
                </label>
                {[1, 2, 4, 8, 12, 24].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    className={`btn btn-sm ${labelCount === cnt ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setLabelCount(cnt)}
                  >
                    {cnt}
                  </button>
                ))}
              </div>

              {/* Printable Label Grid */}
              <div
                className="barcode-print-grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '12px',
                  padding: '12px',
                  background: '#fff',
                  color: '#000',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {Array.from({ length: labelCount }).map((_, idx) => {
                  const codeVal = labelTarget.barcode || labelTarget.sku;
                  const bars = buildCode128Bars(codeVal);
                  const totalWidth = bars.length > 0 ? bars[bars.length - 1].x + bars[bars.length - 1].w + 10 : 120;
                  return (
                    <div
                      key={idx}
                      className="barcode-sticker"
                      style={{
                        border: '1px dashed #ccc',
                        borderRadius: '4px',
                        padding: '8px',
                        textAlign: 'center',
                        background: '#fff',
                        color: '#000',
                      }}
                    >
                      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {businessName || 'ShwePOS'}
                      </div>
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          marginBottom: 4,
                        }}
                      >
                        {language === 'mm' && labelTarget.nameMm ? labelTarget.nameMm : labelTarget.name}
                      </div>
                      <svg
                        viewBox={`0 0 ${totalWidth} 42`}
                        style={{ width: '100%', height: '42px', display: 'block', margin: '0 auto' }}
                      >
                        {bars.map((b, bIdx) => (
                          <rect key={bIdx} x={b.x} y={2} width={b.w} height={38} fill="#000" />
                        ))}
                      </svg>
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1px', marginTop: 2 }}>
                        {codeVal}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 800, marginTop: 2 }}>
                        {formatCurrency(labelTarget.sellingPrice)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="modal-footer no-print">
              <button className="btn btn-secondary" onClick={() => setLabelTarget(null)}>
                {t('Close', 'ပိတ်ရန်')}
              </button>
              <button
                className="btn btn-primary"
                onClick={() => window.print()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Printer size={15} strokeWidth={1.75} />
                {t('Print Labels', 'စတစ်ကာ ပရင့်ထုတ်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
