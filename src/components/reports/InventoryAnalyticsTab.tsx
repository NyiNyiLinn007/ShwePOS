'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { ShoppingBag, RefreshCw, AlertTriangle, Package } from '@/components/ui/Icons';
import type { InventoryAnalyticsReport } from '@/services/inventoryAnalyticsService';

export function InventoryAnalyticsTab() {
  const router = useRouter();
  const { language, t } = useI18n();
  const { addToast } = useToast();

  const [deadDays, setDeadDays] = useState(30);
  const [leadDays, setLeadDays] = useState(14);
  const [data, setData] = useState<InventoryAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const tRef = useRef(t);
  tRef.current = t;

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/inventory-analytics?deadDays=${deadDays}&velocityDays=30&leadDays=${leadDays}`
      );
      if (res.ok) {
        const json: InventoryAnalyticsReport = await res.json();
        setData(json);
        setSelectedIds(new Set(json.reorderSuggestions.slice(0, 15).map((r) => r.productId)));
      }
    } catch {
      addToast(tRef.current('Failed to load inventory analytics', 'ကုန်ပစ္စည်းခွဲခြမ်းစိတ်ဖြာမှု ဖတ်မရပါ'), 'error');
    } finally {
      setLoading(false);
    }
  }, [deadDays, leadDays, addToast]);

  useEffect(() => {
    void fetchAnalytics();
  }, [fetchAnalytics]);

  function toggleSelection(productId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function handleCreatePoFromSelected() {
    if (!data) return;
    const chosen = data.reorderSuggestions.filter((r) => selectedIds.has(r.productId));
    if (chosen.length === 0) {
      addToast(t('Select at least one product to reorder', 'ပြန်မှာမည့်ပစ္စည်း အနည်းဆုံး ၁ ခု ရွေးပါ'), 'error');
      return;
    }
    const payload = chosen.map((r) => ({
      productId: r.productId,
      quantity: r.suggestedQty,
      unitCost: r.costPrice,
    }));
    try {
      sessionStorage.setItem('shwepos-prefill-po', JSON.stringify(payload));
    } catch {
      // ignore storage errors
    }
    router.push('/purchases');
  }

  if (loading && !data) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Controls */}
      <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="flex gap-sm items-center" style={{ flexWrap: 'wrap' }}>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {t('Dead Stock Window:', 'အရောင်းမရှိကာလ -')}
          </label>
          {[30, 60, 90].map((d) => (
            <button
              key={d}
              type="button"
              className={`btn btn-sm ${deadDays === d ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDeadDays(d)}
            >
              {d}d
            </button>
          ))}
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginLeft: 8 }}>
            {t('Lead Days:', 'ကုန်မှာရက် -')}
          </label>
          {[7, 14, 30].map((l) => (
            <button
              key={l}
              type="button"
              className={`btn btn-sm ${leadDays === l ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setLeadDays(l)}
            >
              {l}d
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => void fetchAnalytics()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} />
          {t('Refresh', 'ပြန်ဖတ်ရန်')}
        </button>
      </div>

      {/* Valuation KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-md)' }}>
        <div className="kpi-card">
          <div className="kpi-label">{t('Total Stock Cost Value', 'စုစုပေါင်း ကုန်အရင်းတန်ဖိုး')}</div>
          <div className="kpi-value">{formatCurrency(data.summary.totalCostValue)}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {data.summary.totalActiveProducts} {t('active products', 'ပစ္စည်း')}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t('Potential Retail Value', 'မျှော်မှန်း ရောင်းတန်ဖိုး')}</div>
          <div className="kpi-value" style={{ color: 'var(--primary)' }}>
            {formatCurrency(data.summary.totalRetailValue)}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--success)' }}>
            {t('Est. Profit', 'မျှော်မှန်းအမြတ်')}: {formatCurrency(data.summary.potentialGrossProfit)} ({data.summary.marginPercent}%)
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t(`Dead Stock (${deadDays}d)`, `အရောင်းနှေး/ရပ် (${deadDays} ရက်)`)}</div>
          <div className="kpi-value" style={{ color: data.summary.deadStockCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
            {data.summary.deadStockCount}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {t('Tied-up Capital', 'အရင်းပိတ်ငွေ')}: {formatCurrency(data.summary.deadStockValue)}
          </div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">{t('Reorder Suggestions', 'ပြန်မှာသင့်သည့်ပစ္စည်း')}</div>
          <div className="kpi-value" style={{ color: data.summary.reorderCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {data.summary.reorderCount}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {t('Est. PO Cost', 'ခန့်မှန်းကုန်ကျငွေ')}: {formatCurrency(data.summary.estimatedReorderBudget)}
          </div>
        </div>
      </div>

      {/* Auto-Reorder Suggestions with 1-Click Create PO */}
      <div className="glass-card">
        <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 className="heading-4" style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <ShoppingBag size={18} />
              {t('Auto-Reorder Suggestions', 'အလိုအလျောက် ပြန်မှာရန် အကြံပြုစာရင်း')} ({data.reorderSuggestions.length})
            </h3>
            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
              {t(
                'Based on low-stock thresholds and 30-day base-unit sales velocity',
                'ကုန်နည်းသတ်မှတ်ချက်နှင့် ရက် ၃၀ အရောင်းနှုန်းပေါ်မူတည်၍ တွက်ချက်ထားပါသည်'
              )}
            </p>
          </div>
          {data.reorderSuggestions.length > 0 && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={handleCreatePoFromSelected}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <ShoppingBag size={14} />
              {t('1-Click Create PO', 'ရွေးထားသည်များ PO တန်းဖွင့်ရန်')} ({selectedIds.size})
            </button>
          )}
        </div>
        {data.reorderSuggestions.length === 0 ? (
          <div style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
            {t('All products have sufficient stock.', 'ကုန်ပစ္စည်းအားလုံး လက်ကျန်လုံလောက်ပါသည်။')}
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Stock', 'လက်ကျန်')}</th>
                  <th style={{ textAlign: 'right' }}>{t('30d Sold', '၃၀ရက်ရောင်း')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Days Left', 'ကျန်ရက်')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Suggested Qty', 'မှာသင့်အရေအတွက်')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Est. Cost', 'ခန့်မှန်းတန်ဖိုး')}</th>
                </tr>
              </thead>
              <tbody>
                {data.reorderSuggestions.map((row) => (
                  <tr key={row.productId}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.productId)}
                        onChange={() => toggleSelection(row.productId)}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {language === 'mm' && row.nameMm ? row.nameMm : row.name}
                      </div>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {row.sku} · {row.categoryName}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--danger)', fontWeight: 700 }}>
                      {formatQuantity(row.stockQuantity, row.unit)} {row.unit}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {formatQuantity(row.soldInWindow, row.unit)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {row.daysOfStockLeft !== null ? `${row.daysOfStockLeft}d` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                      +{row.suggestedQty} {row.unit}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(row.estimatedCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dead Stock & Category Valuation Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 'var(--space-lg)' }}>
        <div className="glass-card">
          <h3 className="heading-4" style={{ marginBottom: 'var(--space-md)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
            {t(`Dead Stock (No Sales in ${deadDays}d)`, `အရောင်းမရှိသောပစ္စည်း (${deadDays} ရက်)`)}
          </h3>
          {data.deadStock.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
              {t('No dead stock found!', 'အရောင်းရပ်နေသော ပစ္စည်းမရှိပါ။')}
            </div>
          ) : (
            <div className="table-container" style={{ maxHeight: 340, overflowY: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Stock', 'လက်ကျန်')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Tied-up Cost', 'အရင်းပိတ်ငွေ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.deadStock.slice(0, 30).map((row) => (
                    <tr key={row.productId}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                          {language === 'mm' && row.nameMm ? row.nameMm : row.name}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {row.sku}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatQuantity(row.stockQuantity, row.unit)} {row.unit}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--warning)' }}>
                        {formatCurrency(row.tiedUpCapital)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="glass-card">
          <h3 className="heading-4" style={{ marginBottom: 'var(--space-md)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Package size={18} />
            {t('Valuation by Category', 'အမျိုးအစားအလိုက် ကုန်တန်ဖိုး')}
          </h3>
          <div className="table-container" style={{ maxHeight: 340, overflowY: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Category', 'အမျိုးအစား')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Cost Value', 'အရင်းတန်ဖိုး')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Retail Value', 'ရောင်းတန်ဖိုး')}</th>
                </tr>
              </thead>
              <tbody>
                {data.byCategory.map((cat) => (
                  <tr key={cat.categoryId}>
                    <td style={{ fontWeight: 600 }}>
                      {language === 'mm' && cat.categoryNameMm ? cat.categoryNameMm : cat.categoryName}
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                        {cat.productCount} {t('items', 'မျိုး')}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(cat.costValue)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>
                      {formatCurrency(cat.retailValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
