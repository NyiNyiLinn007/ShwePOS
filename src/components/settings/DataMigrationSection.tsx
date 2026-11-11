'use client';

import React, { useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { Package, FileSpreadsheet, Download, Upload } from '@/components/ui/Icons';

export function DataMigrationSection() {
  const { t } = useI18n();
  const { addToast } = useToast();

  const migrationFileInput = useRef<HTMLInputElement>(null);
  const [migrationFile, setMigrationFile] = useState<File | null>(null);
  const [importingData, setImportingData] = useState(false);

  function downloadMigrationWorkbook(mode: 'template' | 'export') {
    window.location.href = `/api/data-migration?mode=${mode}`;
  }

  async function importMigrationWorkbook() {
    if (!migrationFile) {
      addToast(t('Please choose an Excel file first', 'Excel ဖိုင်ကို အရင်ရွေးပေးပါ'), 'error');
      return;
    }

    setImportingData(true);
    try {
      const formData = new FormData();
      formData.append('file', migrationFile);
      const res = await fetch('/api/data-migration', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data.details?.[0]?.message;
        addToast(detail ? `${data.error}: ${detail}` : data.error || 'Import failed', 'error');
        return;
      }

      addToast(
        data.message || t('Data imported successfully', 'Data များကို အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ'),
        'success'
      );
      setMigrationFile(null);
      if (migrationFileInput.current) migrationFileInput.current.value = '';
    } catch {
      addToast(t('importNetworkError'), 'error');
    } finally {
      setImportingData(false);
    }
  }

  return (
    <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h3 className="heading-4" style={{ marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Package size={18} strokeWidth={1.75} />
          {t('dataMigration')}
        </h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {t(
            'Download an Excel template, fill all data sheets, and import the workbook. You can also export all current data for backup or migration.',
            'Excel Format ကို Download လုပ်ပြီး Data ဖြည့်ကာ ပြန်လည် Import လုပ်နိုင်ပါသည်။ လက်ရှိ Data အားလုံးကိုလည်း Backup သို့မဟုတ် Migration အတွက် Export လုပ်နိုင်ပါသည်။'
          )}
        </p>
      </div>

      <div className="migration-steps" aria-label="Data migration steps">
        <div className="migration-step is-ready">
          <span>1</span>
          <strong>{t('downloadTemplate')}</strong>
        </div>
        <div className="migration-step">
          <span>2</span>
          <strong>{t('fillExcel')}</strong>
        </div>
        <div className="migration-step">
          <span>3</span>
          <strong>{t('chooseFile')}</strong>
        </div>
        <div className="migration-step">
          <span>4</span>
          <strong>{t('importReview')}</strong>
        </div>
      </div>

      <div
        className="migration-actions"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
          alignItems: 'center',
        }}
      >
        <button
          className="btn btn-secondary"
          onClick={() => downloadMigrationWorkbook('template')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <FileSpreadsheet size={15} strokeWidth={1.75} />
          {t('downloadExcelTemplate')}
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => downloadMigrationWorkbook('export')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={15} strokeWidth={1.75} />
          {t('exportAllData')}
        </button>
        <input
          ref={migrationFileInput}
          type="file"
          accept=".xlsx"
          style={{ display: 'none' }}
          onChange={(event) => setMigrationFile(event.target.files?.[0] || null)}
        />
        <button
          className="btn btn-secondary"
          onClick={() => migrationFileInput.current?.click()}
          disabled={importingData}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Upload size={15} strokeWidth={1.75} />
          {t('chooseExcelFile')}
        </button>
        <button
          className="btn btn-primary"
          onClick={importMigrationWorkbook}
          disabled={!migrationFile || importingData}
        >
          {importingData ? t('importing') : t('importData')}
        </button>
      </div>

      {migrationFile && (
        <div
          style={{
            marginTop: 'var(--space-md)',
            padding: 'var(--space-sm) var(--space-md)',
            background: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-muted)',
          }}
        >
          {t('Selected file', 'ရွေးထားသောဖိုင်')}:{' '}
          <strong style={{ color: 'var(--text-primary)' }}>{migrationFile.name}</strong>
        </div>
      )}

      <p
        style={{
          marginTop: 'var(--space-md)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}
      >
        {t(
          'Import uses upsert and does not delete records. User passwords are not included in exports; existing users keep their current password.',
          'Import သည် ရှိပြီးသား Record များကို Update/Create လုပ်ပြီး မပါသော Record များကို မဖျက်ပါ။ Export ဖိုင်တွင် Password များမပါပါ။ ရှိပြီးသား User များ၏ password ကို မပြောင်းပါ။'
        )}
      </p>
    </div>
  );
}
