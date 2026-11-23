'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, isFractionalUnit } from '@/lib/utils';
import { resizeImageToDataUrl } from '@/lib/image';
import { Upload, X, Plus, Layers, Trash2 } from '@/components/ui/Icons';

export interface ProductUnitFormRow {
  id?: string;
  unitName: string;
  nameMm: string;
  conversionFactor: string;
  sellingPrice: string;
  barcode: string;
}

export interface ProductFormInput {
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
  productUnits: ProductUnitFormRow[];
}

export interface ProductCategoryOption {
  id: string;
  name: string;
  nameMm: string | null;
}

export const PRODUCT_UNITS = [
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

export const emptyProductForm: ProductFormInput = {
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
  productUnits: [],
};

export function generateRandomSKU(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'PRD-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

interface ProductFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: ProductFormInput;
  formErrors: Record<string, string>;
  categories: ProductCategoryOption[];
  saving: boolean;
  onChange: (
    field: keyof ProductFormInput,
    value: string | boolean | ProductUnitFormRow[]
  ) => void;
  onSave: () => void;
  onClose: () => void;
}

export function ProductFormModal({
  isOpen,
  isEditing,
  formData,
  formErrors,
  categories,
  saving,
  onChange,
  onSave,
  onClose,
}: ProductFormModalProps) {
  const { t } = useI18n();
  const { addToast } = useToast();

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing
              ? t('Edit Product', 'ကုန်ပစ္စည်းပြင်ဆင်ရန်')
              : t('Add Product', 'ကုန်ပစ္စည်းထည့်ရန်')}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
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
                onChange={(e) => onChange('name', e.target.value)}
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
                onChange={(e) => onChange('nameMm', e.target.value)}
              />
            </div>

            {/* SKU */}
            <div className="input-group">
              <label className="input-label">
                SKU *
                {!isEditing && (
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
                    onClick={() => onChange('sku', generateRandomSKU())}
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
                onChange={(e) => onChange('sku', e.target.value)}
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
                onChange={(e) => onChange('barcode', e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>

            {/* Category */}
            <div className="input-group">
              <label className="input-label">Category *</label>
              <select
                className={`input ${formErrors.categoryId ? 'input-error' : ''}`}
                value={formData.categoryId}
                onChange={(e) => onChange('categoryId', e.target.value)}
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
                onChange={(e) => onChange('unit', e.target.value)}
              >
                {PRODUCT_UNITS.map((u) => (
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
                onChange={(e) => onChange('costPrice', e.target.value)}
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
                onChange={(e) => onChange('sellingPrice', e.target.value)}
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
                onChange={(e) => onChange('stockQuantity', e.target.value)}
              />
              {formErrors.stockQuantity && (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                  {formErrors.stockQuantity}
                </span>
              )}
            </div>

            {/* Low Stock Threshold */}
            <div className="input-group">
              <label className="input-label">
                {t('Low Stock Threshold', 'ကုန်လက်ကျန်နည်းသတ်မှတ်ချက်')}
              </label>
              <input
                type="number"
                min="0"
                step={isFractionalUnit(formData.unit) ? '0.01' : '1'}
                className={`input ${formErrors.lowStockThreshold ? 'input-error' : ''}`}
                placeholder="10"
                value={formData.lowStockThreshold}
                onChange={(e) => onChange('lowStockThreshold', e.target.value)}
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
                onChange={(e) => onChange('batchNumber', e.target.value)}
              />
            </div>

            {/* Expiry Date */}
            <div className="input-group">
              <label className="input-label">{t('Expiry Date', 'သက်တမ်းကုန်ဆုံးရက်')}</label>
              <input
                type="date"
                className="input"
                value={formData.expiryDate}
                onChange={(e) => onChange('expiryDate', e.target.value)}
              />
            </div>

            {/* Image Upload & URL - full width */}
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">
                {t('Product Image (Upload or URL)', 'ကုန်ပစ္စည်းပုံ (ပုံတင်ရန် သို့မဟုတ် လင့်ခ်)')}
              </label>
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
                <label
                  className="btn btn-secondary btn-sm"
                  style={{ cursor: 'pointer', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
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
                        onChange('imageUrl', dataUrl);
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
                  onChange={(e) => onChange('imageUrl', e.target.value)}
                />
                {formData.imageUrl && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => onChange('imageUrl', '')}
                    style={{ color: 'var(--danger)' }}
                  >
                    <X size={14} strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>

            {/* Alternate Packaging Units (Wholesale / Multi-Unit) - full width */}
            <div
              style={{
                gridColumn: '1 / -1',
                padding: 'var(--space-md)',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 'var(--space-sm)',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                  <Layers size={15} strokeWidth={1.75} />
                  {t(
                    'Wholesale / Multi-Unit Packaging (Optional)',
                    'လက်ကား / ယူနစ်ခွဲ ထုပ်ပိုးမှုများ (ဥပမာ - ဖာ၊ ဒါဇင်)'
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() =>
                    onChange('productUnits', [
                      ...formData.productUnits,
                      {
                        unitName: 'box',
                        nameMm: 'ဖာ',
                        conversionFactor: '12',
                        sellingPrice: String(
                          Math.round((Number(formData.sellingPrice) || 0) * 12)
                        ),
                        barcode: '',
                      },
                    ])
                  }
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                >
                  <Plus size={13} strokeWidth={2} />
                  {t('Add Unit', 'ယူနစ်ထပ်ထည့်ရန်')}
                </button>
              </div>
              {formData.productUnits.length === 0 ? (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {t(
                    `Base unit is "${formData.unit}". Add pack/dozen/carton units to sell wholesale directly in POS while deducting base stock automatically.`,
                    `အခြေခံယူနစ်မှာ "${formData.unit}" ဖြစ်သည်။ POS တွင် တစ်ဖာ/တစ်ဒါဇင်လိုက် ရောင်းနိုင်ရန် ယူနစ်အပိုများ ထည့်သွင်းနိုင်ပါသည်။`
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {formData.productUnits.map((row, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 90px 110px 1fr auto',
                        gap: 6,
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type="text"
                        className="input"
                        placeholder={t('Unit (e.g. carton)', 'ယူနစ် (ဥပမာ carton)')}
                        value={row.unitName}
                        onChange={(e) => {
                          const next = [...formData.productUnits];
                          next[idx] = { ...row, unitName: e.target.value };
                          onChange('productUnits', next);
                        }}
                        style={{ fontSize: 12 }}
                      />
                      <input
                        type="number"
                        className="input"
                        min="0.001"
                        step="any"
                        placeholder={`× ${formData.unit}`}
                        title={t(`Number of base units (${formData.unit}) per 1 unit`, `၁ ယူနစ်တွင် ပါဝင်သည့် ${formData.unit} အရေအတွက်`)}
                        value={row.conversionFactor}
                        onChange={(e) => {
                          const next = [...formData.productUnits];
                          next[idx] = { ...row, conversionFactor: e.target.value };
                          onChange('productUnits', next);
                        }}
                        style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                      />
                      <input
                        type="number"
                        className="input"
                        min="0"
                        placeholder={t('Price (K)', 'ဈေးနှုန်း (K)')}
                        value={row.sellingPrice}
                        onChange={(e) => {
                          const next = [...formData.productUnits];
                          next[idx] = { ...row, sellingPrice: e.target.value };
                          onChange('productUnits', next);
                        }}
                        style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                      />
                      <input
                        type="text"
                        className="input"
                        placeholder={t('Unit Barcode (optional)', 'ဘားကုဒ် (ရှိပါက)')}
                        value={row.barcode}
                        onChange={(e) => {
                          const next = [...formData.productUnits];
                          next[idx] = { ...row, barcode: e.target.value };
                          onChange('productUnits', next);
                        }}
                        style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--danger)' }}
                        onClick={() =>
                          onChange(
                            'productUnits',
                            formData.productUnits.filter((_, i) => i !== idx)
                          )
                        }
                      >
                        <Trash2 size={14} strokeWidth={1.75} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Toggle - full width */}
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
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
                  onChange={(e) => onChange('isActive', e.target.checked)}
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
            {Number(formData.costPrice) > 0 && Number(formData.sellingPrice) > 0 && (
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
                  {formatCurrency(Number(formData.sellingPrice) - Number(formData.costPrice))}
                </span>
                <span>
                  {t('Markup', 'တန်ဖိုးတင်')}:{' '}
                  {(
                    ((Number(formData.sellingPrice) - Number(formData.costPrice)) /
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
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {t('Cancel', 'မလုပ်တော့ပါ')}
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving
              ? t('Saving...', 'သိမ်းနေသည်...')
              : isEditing
                ? t('Update Product', 'ကုန်ပစ္စည်းအချက်အလက်ပြင်ရန်')
                : t('Create Product', 'ကုန်ပစ္စည်းဖန်တီးရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}
