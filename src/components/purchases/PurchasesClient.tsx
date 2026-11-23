'use client';

import React, { useState, useMemo } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatDateTime, formatQuantity } from '@/lib/utils';
import { getPaymentMethodLabel } from '@/lib/saleHelpers';
import { ShoppingBag, Plus, Eye, Ban, X } from '@/components/ui/Icons';
import {
  PurchaseFormModal,
  PurchaseSupplierOption,
  PurchaseProductOption,
} from '@/components/purchases/PurchaseFormModal';

interface PurchaseOrderRecord {
  id: string;
  poNumber: string;
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: string;
  status: string;
  notes: string | null;
  createdAt: string | Date;
  supplier: { id: string; name: string; phone: string | null };
  user: { id: string; name: string };
  items: Array<{
    id: string;
    quantity: number;
    unitCost: number;
    total: number;
    batchNumber: string | null;
    product: { id: string; name: string; nameMm: string | null; sku: string; unit: string };
  }>;
}

interface PurchasesClientProps {
  initialOrders: PurchaseOrderRecord[];
  suppliers: PurchaseSupplierOption[];
  products: PurchaseProductOption[];
}

export function PurchasesClient({
  initialOrders,
  suppliers,
  products,
}: PurchasesClientProps) {
  const { t } = useI18n();
  const { addToast } = useToast();

  const [orders, setOrders] = useState<PurchaseOrderRecord[]>(initialOrders);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrderRecord | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!supplierFilter) return orders;
    return orders.filter((o) => o.supplier.id === supplierFilter);
  }, [orders, supplierFilter]);

  const totalSpent = useMemo(
    () =>
      filtered
        .filter((o) => o.status === 'RECEIVED')
        .reduce((sum, o) => sum + o.totalAmount, 0),
    [filtered]
  );

  const totalDue = useMemo(
    () =>
      filtered
        .filter((o) => o.status === 'RECEIVED')
        .reduce((sum, o) => sum + o.dueAmount, 0),
    [filtered]
  );

  async function handleCancelPo(order: PurchaseOrderRecord) {
    if (
      !window.confirm(
        t(
          `Cancel ${order.poNumber} and reverse received stock?`,
          `${order.poNumber} ကို ပယ်ဖျက်ပြီး Stock ပြန်နှုတ်မည်မှာ သေချာပါသလား?`
        )
      )
    ) {
      return;
    }
    setCancellingId(order.id);
    try {
      const res = await fetch(`/api/purchases/${order.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to cancel PO', 'ပယ်ဖျက်မရပါ'), 'error');
        return;
      }
      setOrders((prev) => prev.map((o) => (o.id === order.id ? data : o)));
      if (selectedOrder?.id === order.id) setSelectedOrder(data);
      useAppStore.getState().triggerLowStockRefresh();
      addToast(t('Purchase order cancelled', 'ကုန်အဝယ်ဘောင်ချာ ပယ်ဖျက်ပြီးပါပြီ'), 'success');
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Purchase Orders', 'ကုန်အဝယ်ဘောင်ချာများ')}</h1>
          <p className="page-subtitle mm-text">
            {t('Goods Receiving, Cost Updates & Supplier Bills', 'ကုန်အဝယ်လက်ခံခြင်း၊ အရင်းဈေးပြင်ဆင်ခြင်းနှင့် Stock သွင်းခြင်း')}
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} strokeWidth={2} />
            {t('Receive Purchase Order', 'ကုန်အဝယ် အသစ်သွင်းရန်')}
          </button>
        </div>
      </div>

      <div className="page-body">
        <div className="flex gap-md" style={{ marginBottom: 'var(--space-lg)', flexWrap: 'wrap' }}>
          <div
            style={{
              flex: '1 1 200px',
              padding: 'var(--space-lg)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
              {t('Total Purchase Orders', 'ကုန်အဝယ်ဘောင်ချာ စုစုပေါင်း')}
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700 }}>{filtered.length}</div>
          </div>
          <div
            style={{
              flex: '1 1 200px',
              padding: 'var(--space-lg)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
              {t('Total Purchased Value', 'စုစုပေါင်း ကုန်အဝယ်တန်ဖိုး')}
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(totalSpent)}
            </div>
          </div>
          <div
            style={{
              flex: '1 1 200px',
              padding: 'var(--space-lg)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
              {t('Unpaid Balance', 'ပေးရန်ကျန်ငွေ')}
            </div>
            <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: totalDue > 0 ? 'var(--danger)' : 'var(--success)', fontFamily: 'var(--font-mono)' }}>
              {formatCurrency(totalDue)}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 'var(--space-lg)', maxWidth: 280 }}>
          <select
            className="input"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
          >
            <option value="">{t('All Suppliers', 'ပေးသွင်းသူအားလုံး')}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ShoppingBag size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-title">{t('No purchase orders yet', 'ကုန်အဝယ်မှတ်တမ်း မရှိသေးပါ')}</div>
            <div className="empty-state-text">
              {t('Receive goods from suppliers to automatically update product stock and latest cost price', 'ပေးသွင်းသူထံမှ ကုန်အဝယ်သွင်းလိုက်သည်နှင့် Stock နှင့် အရင်းဈေး အလိုအလျောက် တက်သွားပါမည်')}
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>{t('Date & Time', 'ရက်စွဲနှင့်အချိန်')}</th>
                  <th>{t('Supplier', 'ပေးသွင်းသူ')}</th>
                  <th style={{ textAlign: 'center' }}>{t('items')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Paid', 'ပေးပြီး')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Due', 'ကျန်ငွေ')}</th>
                  <th>{t('status')}</th>
                  <th style={{ width: 100 }}>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                        {order.poNumber}
                      </code>
                    </td>
                    <td style={{ fontSize: 'var(--text-sm)' }}>{formatDateTime(order.createdAt)}</td>
                    <td style={{ fontWeight: 600 }}>{order.supplier.name}</td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {order.items.length}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                      {formatCurrency(order.totalAmount)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(order.paidAmount)}
                    </td>
                    <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: order.dueAmount > 0 ? 'var(--danger)' : undefined }}>
                      {formatCurrency(order.dueAmount)}
                    </td>
                    <td>
                      <span className={`badge ${order.status === 'RECEIVED' ? 'badge-success' : 'badge-danger'}`}>
                        {order.status === 'RECEIVED'
                          ? t('Received', 'လက်ခံပြီး')
                          : t('Cancelled', 'ပယ်ဖျက်ပြီး')}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setSelectedOrder(order)}
                          title={t('View items', 'အသေးစိတ်ကြည့်ရန်')}
                        >
                          <Eye size={15} strokeWidth={1.75} />
                        </button>
                        {order.status === 'RECEIVED' && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ color: 'var(--danger)' }}
                            disabled={cancellingId === order.id}
                            onClick={() => handleCancelPo(order)}
                            title={t('Cancel PO', 'ပယ်ဖျက်ရန်')}
                          >
                            <Ban size={15} strokeWidth={1.75} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PurchaseFormModal
        isOpen={showCreateModal}
        suppliers={suppliers}
        products={products}
        onCreated={(created) => {
          setOrders((prev) => [created as PurchaseOrderRecord, ...prev]);
          useAppStore.getState().triggerLowStockRefresh();
        }}
        onClose={() => setShowCreateModal(false)}
      />

      {selectedOrder && (
        <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 className="modal-title">{selectedOrder.poNumber}</h2>
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setSelectedOrder(null)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 'var(--text-sm)' }}>
                <div><strong>{t('Supplier', 'ပေးသွင်းသူ')}:</strong> {selectedOrder.supplier.name}</div>
                <div><strong>{t('Received By', 'လက်ခံသူ')}:</strong> {selectedOrder.user.name}</div>
                <div><strong>{t('Date', 'ရက်စွဲ')}:</strong> {formatDateTime(selectedOrder.createdAt)}</div>
                <div><strong>{t('Payment', 'ငွေပေးချေမှု')}:</strong> {getPaymentMethodLabel(selectedOrder.paymentMethod, t)}</div>
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Qty', 'အရေအတွက်')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Unit Cost', 'အရင်းဈေး')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{item.product.name}</div>
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            {item.product.sku} {item.batchNumber ? `· Batch: ${item.batchNumber}` : ''}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {formatQuantity(item.quantity, item.product.unit)} {item.product.unit}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedOrder.notes && (
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  <strong>{t('notes')}:</strong> {selectedOrder.notes}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
