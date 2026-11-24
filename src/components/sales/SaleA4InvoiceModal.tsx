'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { formatCurrency, formatDateTime, formatQuantity } from '@/lib/utils';
import { getPaymentMethodLabel, type SaleRecord } from '@/lib/saleHelpers';
import { printElementById } from '@/lib/print';
import { FileText, Printer, X } from '@/components/ui/Icons';

interface SaleA4InvoiceModalProps {
  sale: SaleRecord | null;
  onClose: () => void;
}

export function SaleA4InvoiceModal({ sale, onClose }: SaleA4InvoiceModalProps) {
  const { language, t } = useI18n();
  const businessName = useSettingsStore((s) => s.businessName);
  const businessNameMm = useSettingsStore((s) => s.businessNameMm);
  const businessAddress = useSettingsStore((s) => s.address);
  const businessPhone = useSettingsStore((s) => s.phone);
  const businessLogo = useSettingsStore((s) => s.logo);
  const receiptFooter = useSettingsStore((s) => s.receiptFooter);

  const [docType, setDocType] = useState<'INVOICE' | 'DELIVERY'>('INVOICE');

  if (!sale) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} strokeWidth={1.75} />
            {docType === 'INVOICE'
              ? t('Formal A4 Invoice', 'A4 တရားဝင် ဘောင်ချာ')
              : t('Delivery Order / Note', 'ကုန်ပို့လွှာ (Delivery Order)')}{' '}
            — {sale.invoiceNumber}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="flex gap-xs" style={{ marginBottom: 'var(--space-md)' }}>
            <button
              type="button"
              className={`btn btn-sm ${docType === 'INVOICE' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDocType('INVOICE')}
            >
              {t('Tax / Formal Invoice', 'A4 ဘောင်ချာ')}
            </button>
            <button
              type="button"
              className={`btn btn-sm ${docType === 'DELIVERY' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setDocType('DELIVERY')}
            >
              {t('Delivery Order (No Prices)', 'ကုန်ပို့လွှာ (ဈေးနှုန်းမပါ)')}
            </button>
          </div>

          <div
            id="sale-a4-invoice-print"
            style={{
              background: '#ffffff',
              color: '#000000',
              padding: 28,
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {businessLogo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={businessLogo} alt="Logo" style={{ width: 52, height: 52, objectFit: 'contain' }} />
                )}
                <div>
                  <div style={{ fontSize: 19, fontWeight: 800 }}>
                    {businessName} {businessNameMm ? `(${businessNameMm})` : ''}
                  </div>
                  {businessAddress && <div style={{ fontSize: 11, color: '#334155' }}>{businessAddress}</div>}
                  {businessPhone && <div style={{ fontSize: 11, color: '#334155' }}>Tel: {businessPhone}</div>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#b45309' }}>
                  {docType === 'INVOICE' ? 'INVOICE' : 'DELIVERY ORDER'}
                </div>
                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>
                  {sale.invoiceNumber}
                </div>
                <div style={{ fontSize: 11, color: '#475569' }}>{formatDateTime(sale.createdAt)}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 14 }}>
              <div>
                <div>
                  <strong>{t('Bill To', 'ဝယ်ယူသူ')}:</strong> {sale.customer?.name || t('Walk-in Customer', 'လက်လီဝယ်သူ')}
                </div>
                {sale.customer?.phone && (
                  <div>
                    <strong>{t('Phone', 'ဖုန်း')}:</strong> {sale.customer.phone}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>
                  <strong>{t('Cashier', 'ငွေကိုင်')}:</strong> {sale.user?.name || '—'}
                </div>
                {docType === 'INVOICE' && (
                  <div>
                    <strong>{t('Payment', 'ငွေပေးချေမှု')}:</strong> {getPaymentMethodLabel(sale.paymentMethod, t)}
                  </div>
                )}
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #0f172a' }}>
                  <th style={{ padding: 6, textAlign: 'left' }}>#</th>
                  <th style={{ padding: 6, textAlign: 'left' }}>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                  <th style={{ padding: 6, textAlign: 'right' }}>{t('Qty', 'အရေအတွက်')}</th>
                  {docType === 'INVOICE' && (
                    <>
                      <th style={{ padding: 6, textAlign: 'right' }}>{t('Unit Price', 'တစ်ခုဈေး')}</th>
                      <th style={{ padding: 6, textAlign: 'right' }}>{t('Discount', 'လျှော့ဈေး')}</th>
                      <th style={{ padding: 6, textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {(sale.items ?? []).map((item, idx) => {
                  const soldUnit = item.unitName || item.product?.unit || 'pcs';
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: 6 }}>{idx + 1}</td>
                      <td style={{ padding: 6 }}>
                        <div style={{ fontWeight: 600 }}>
                          {language === 'mm' && item.product?.nameMm
                            ? item.product.nameMm
                            : item.product?.name}
                        </div>
                        {item.product?.sku && (
                          <div style={{ fontSize: 10, color: '#64748b' }}>{item.product.sku}</div>
                        )}
                      </td>
                      <td style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace' }}>
                        {formatQuantity(item.quantity, soldUnit)} {soldUnit}
                      </td>
                      {docType === 'INVOICE' && (
                        <>
                          <td style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace' }}>
                            {formatCurrency(item.unitPrice)}
                          </td>
                          <td style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace' }}>
                            {item.discount > 0 ? `−${formatCurrency(item.discount)}` : '—'}
                          </td>
                          <td style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                            {formatCurrency(item.total)}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {docType === 'INVOICE' && (
              <div style={{ maxWidth: 280, marginLeft: 'auto', fontSize: 12, marginBottom: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                  <span>{t('Subtotal', 'စုစုပေါင်း')}</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatCurrency(sale.subtotal)}</span>
                </div>
                {sale.discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#b91c1c' }}>
                    <span>{t('Discount', 'လျှော့ဈေး')}</span>
                    <span style={{ fontFamily: 'monospace' }}>−{formatCurrency(sale.discountAmount)}</span>
                  </div>
                )}
                {sale.taxAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span>{t('Tax', 'အခွန်')}</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(sale.taxAmount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0 4px', marginTop: 4, borderTop: '2px solid #0f172a', fontWeight: 800, fontSize: 15 }}>
                  <span>{t('TOTAL', 'စုစုပေါင်းကျသင့်ငွေ')}</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatCurrency(sale.totalAmount)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                  <span>{t('Paid', 'ပေးငွေ')}</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatCurrency(sale.paidAmount)}</span>
                </div>
                {(sale.dueAmount ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#b91c1c', fontWeight: 700 }}>
                    <span>{t('Credit Due', 'ကြွေးကျန်')}</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(sale.dueAmount ?? 0)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Signature Lines */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, marginTop: 32, fontSize: 11, textAlign: 'center', color: '#475569' }}>
              <div>
                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6 }}>
                  {t('Authorized Signature', 'ဆိုင်တာဝန်ခံ လက်မှတ်')}
                </div>
              </div>
              <div>
                <div style={{ borderTop: '1px solid #94a3b8', paddingTop: 6 }}>
                  {t('Customer Received By', 'လက်ခံသူ လက်မှတ်')}
                </div>
              </div>
            </div>
            {receiptFooter && (
              <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#64748b' }}>
                {receiptFooter}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('Close', 'ပိတ်ရန်')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              printElementById('sale-a4-invoice-print', {
                title: `${sale.invoiceNumber} - ${docType === 'INVOICE' ? 'A4 Invoice' : 'Delivery Order'}`,
                paperSize: 'A4',
              })
            }
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} />
            {t('Print A4', 'A4 ပရင့်ထုတ်ရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}
