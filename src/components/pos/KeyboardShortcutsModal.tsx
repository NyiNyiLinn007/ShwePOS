'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';
import { Keyboard, X } from '@/components/ui/Icons';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  {
    keys: ['F2'],
    en: 'Focus product search / barcode scanner input',
    mm: 'ကုန်ပစ္စည်းရှာဖွေရန် / ဘားကုဒ်ဖတ်ရန် အကွက်သို့ သွားမည်',
  },
  {
    keys: ['Enter'],
    en: 'Auto-add exact barcode or SKU match while in search box',
    mm: 'ရှာဖွေကွက်တွင် ဘားကုဒ် သို့မဟုတ် SKU ကိုက်ညီပါက ခြင်းတောင်းထဲ တန်းထည့်မည်',
  },
  {
    keys: ['F4'],
    en: 'Hold current bill (or open Held Bills list if cart is empty)',
    mm: 'လက်ရှိဘောင်ချာ ဆိုင်းငံ့ထားမည် (သို့) ဆိုင်းငံ့စာရင်း ဖွင့်မည်',
  },
  {
    keys: ['F8'],
    en: 'Open Payment Modal & focus Customer search',
    mm: 'ငွေရှင်းမျက်နှာပြင် ဖွင့်ပြီး ဖောက်သည်ရှာရန် အကွက်သို့ တန်းသွားမည်',
  },
  {
    keys: ['F9', 'Ctrl + Enter'],
    en: 'Open Payment Modal to complete checkout',
    mm: 'ငွေပေးချေရန် Payment Modal ဖွင့်မည်',
  },
  {
    keys: ['Esc'],
    en: 'Close open modal or start a new sale from receipt',
    mm: 'ပွင့်နေသော Modal ကို ပိတ်မည် / ဘောင်ချာအသစ် စမည်',
  },
  {
    keys: ['?'],
    en: 'Toggle this Keyboard Shortcuts guide',
    mm: 'ကီးဘုတ်ဖြတ်လမ်းလမ်းညွှန် ဖွင့်/ပိတ် လုပ်မည်',
  },
];

export function KeyboardShortcutsModal({ isOpen, onClose }: KeyboardShortcutsModalProps) {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 500 }}
      >
        <div className="modal-header">
          <span className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Keyboard size={18} strokeWidth={1.75} />
            {t('POS Keyboard Shortcuts', 'POS ကီးဘုတ်ဖြတ်လမ်းခလုတ်များ')}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SHORTCUTS.map((sc, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                padding: '8px 10px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
                {t(sc.en, sc.mm)}
              </span>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                {sc.keys.map((k) => (
                  <kbd
                    key={k}
                    style={{
                      padding: '2px 8px',
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {t('Got it', 'နားလည်ပါပြီ')}
          </button>
        </div>
      </div>
    </div>
  );
}
