'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { Camera, RefreshCw, X } from '@/components/ui/Icons';

interface CameraBarcodeModalProps {
  isOpen: boolean;
  onDetected: (code: string) => void;
  onClose: () => void;
  continuous?: boolean;
}

export function CameraBarcodeModal({
  isOpen,
  onDetected,
  onClose,
  continuous = false,
}: CameraBarcodeModalProps) {
  const { t } = useI18n();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceIdx, setDeviceIdx] = useState(0);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const lastCodeTimeRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const onDetectedRef = useRef(onDetected);
  const onCloseRef = useRef(onClose);
  onDetectedRef.current = onDetected;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    let stopControls: { stop: () => void } | null = null;

    async function startScanner() {
      setError(null);
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (!active) return;

        const videoDevices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (!active) return;
        setDevices(videoDevices);

        if (videoDevices.length === 0) {
          setError(t('No camera detected on this device.', 'ဤစက်တွင် ကင်မရာမတွေ့ပါ။'));
          return;
        }

        // Prefer rear/environment camera by default on first open
        let chosen = videoDevices[deviceIdx % videoDevices.length];
        if (deviceIdx === 0) {
          const backCam = videoDevices.find((d) =>
            /back|rear|environment/i.test(d.label)
          );
          if (backCam) chosen = backCam;
        }

        const reader = new BrowserMultiFormatReader();
        if (!videoRef.current) return;

        stopControls = await reader.decodeFromVideoDevice(
          chosen.deviceId,
          videoRef.current,
          (result) => {
            if (!active || !result) return;
            const code = result.getText().trim();
            if (!code) return;
            const now = Date.now();
            // Debounce identical consecutive reads (1.4s cooldown)
            if (
              lastCodeTimeRef.current.code === code &&
              now - lastCodeTimeRef.current.at < 1400
            ) {
              return;
            }
            lastCodeTimeRef.current = { code, at: now };
            setLastScanned(code);
            onDetectedRef.current(code);
            if (!continuous) {
              stopControls?.stop();
              onCloseRef.current();
            }
          }
        );
      } catch (err) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : '';
        if (/denied|permission/i.test(msg)) {
          setError(
            t(
              'Camera permission denied. Please allow camera access in browser settings.',
              'ကင်မရာအသုံးပြုခွင့် ပိတ်ထားပါသည်။ Browser ဆက်တင်တွင် ခွင့်ပြုပေးပါ။'
            )
          );
        } else {
          setError(
            t(
              'Could not start camera scanner. Ensure HTTPS or localhost is used.',
              'ကင်မရာဖွင့်မရပါ။ HTTPS သို့မဟုတ် localhost ဖြင့် အသုံးပြုပါ။'
            )
          );
        }
      }
    }

    void startScanner();

    return () => {
      active = false;
      try {
        stopControls?.stop();
      } catch {
        // ignore cleanup error
      }
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [isOpen, deviceIdx, continuous, t]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      style={{ zIndex: 1150 }}
      onClick={onClose}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 460 }}
      >
        <div className="modal-header">
          <h3 className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Camera size={18} strokeWidth={1.75} />
            {t('Camera Barcode Scanner', 'ကင်မရာ ဘားကုဒ်ဖတ်စက်')}
          </h3>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {error ? (
            <div
              style={{
                padding: 'var(--space-md)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--danger-light)',
                color: 'var(--danger)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {error}
            </div>
          ) : (
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '4 / 3',
                background: '#09090B',
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                border: '1px solid var(--border-color)',
              }}
            >
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {/* Scan Guide Frame */}
              <div
                style={{
                  position: 'absolute',
                  inset: '20% 12%',
                  border: '2px solid var(--primary)',
                  borderRadius: 8,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.35)',
                  pointerEvents: 'none',
                }}
              />
            </div>
          )}

          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', textAlign: 'center' }}>
            {lastScanned
              ? `${t('Last scanned', 'နောက်ဆုံးဖတ်မိ')}: ${lastScanned}`
              : t(
                  'Point camera at EAN-13, Code-128, UPC, or QR barcode.',
                  'EAN-13, Code-128 သို့မဟုတ် QR ဘားကုဒ်ကို ကင်မရာရှေ့ချိန်ပါ။'
                )}
          </div>
        </div>
        <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
          {devices.length > 1 ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setDeviceIdx((i) => i + 1)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={14} strokeWidth={1.75} />
              {t('Switch Camera', 'ကင်မရာပြောင်းရန်')}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('Close', 'ပိတ်ရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}
