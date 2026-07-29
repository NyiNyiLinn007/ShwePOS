'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';

export default function SaleDetailHeader({ invoiceNumber }: { invoiceNumber: string }) {
  const { t } = useI18n();

  return (
    <div className="page-header">
      <div className="page-title-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <Link
            href="/sales"
            className="btn btn-ghost btn-icon"
            style={{ fontSize: 'var(--text-lg)' }}
            aria-label={t('back')}
          >
            ←
          </Link>
          <div>
            <h1 className="page-title">{invoiceNumber}</h1>
            <p className="page-subtitle">{t('saleDetails')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
