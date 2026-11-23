'use client';

import React, { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { X } from '@/components/ui/Icons';

interface ImageLightboxModalProps {
  isOpen: boolean;
  src: string;
  alt: string;
  title?: string;
  subtitle?: string;
  highlightText?: string;
  whiteFrame?: boolean;
  onClose: () => void;
}

export function ImageLightboxModal({
  isOpen,
  src,
  alt,
  title,
  subtitle,
  highlightText,
  whiteFrame = true,
  onClose,
}: ImageLightboxModalProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen || !src) return null;

  return (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 1200,
        background: 'rgba(9, 9, 11, 0.82)',
        padding: 'var(--space-md)',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title || alt}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(92vw, 460px)',
          maxWidth: 460,
          maxHeight: '92vh',
          overflow: 'hidden',
        }}
      >
        <div className="modal-header">
          <h3 className="modal-title" style={{ fontSize: 'var(--text-base)' }}>
            {title || alt}
          </h3>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label={t('Close', 'ပိတ်ရန်')}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div
          className="modal-body"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            gap: 'var(--space-md)',
            padding: 'var(--space-lg)',
          }}
        >
          <div
            style={{
              width: '100%',
              padding: whiteFrame ? 16 : 0,
              background: whiteFrame ? '#ffffff' : 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              style={{
                width: '100%',
                maxWidth: 360,
                maxHeight: '55vh',
                objectFit: 'contain',
                display: 'block',
                borderRadius: whiteFrame ? 4 : 'var(--radius-md)',
              }}
            />
          </div>

          {subtitle && (
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {subtitle}
            </div>
          )}

          {highlightText && (
            <div
              style={{
                fontSize: 'var(--text-2xl)',
                fontWeight: 800,
                fontFamily: 'var(--font-mono)',
                fontVariantNumeric: 'tabular-nums',
                color: 'var(--primary)',
                padding: '6px 18px',
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              {highlightText}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ justifyContent: 'center' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('Close', 'ပိတ်ရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}
