'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from '@/components/ui/Icons';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = `toast-${++counterRef.current}-${Date.now()}`;
      const toast: Toast = { id, message, type };
      setToasts((prev) => [...prev, toast]);

      // Auto-dismiss after 4 seconds
      setTimeout(() => {
        removeToast(id);
      }, 4000);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
              {toast.type === 'success' && <CheckCircle2 size={16} strokeWidth={2} />}
              {toast.type === 'error' && <AlertCircle size={16} strokeWidth={2} />}
              {toast.type === 'warning' && <AlertTriangle size={16} strokeWidth={2} />}
              {toast.type === 'info' && <Info size={16} strokeWidth={2} />}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button
              className="toast-close"
              onClick={() => removeToast(toast.id)}
              aria-label={t('close')}
              style={{ display: 'inline-flex', alignItems: 'center' }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
