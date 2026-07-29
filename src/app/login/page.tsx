'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';

export default function LoginPage() {
  const router = useRouter();
  const { toggleLanguage } = useAppStore();
  const { language, t } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSessionConfirm, setShowSessionConfirm] = useState(false);
  const [lastLoginInfo, setLastLoginInfo] = useState<string | null>(null);

  const doLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(t('invalidCredentials'));
      } else if (result?.ok) {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError(t('unexpectedError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email || !password) {
      setError(t('enterCredentials'));
      return;
    }

    setIsLoading(true);

    try {
      // The credential provider performs the only password verification. This
      // avoids a public pre-login password oracle and duplicate bcrypt work.
      await doLogin();
    } catch {
      setError(t('unexpectedError'));
      setIsLoading(false);
    }
  };

  const handleConfirmLogin = async () => {
    setShowSessionConfirm(false);
    await doLogin();
  };

  return (
    <div className="login-page">
      <div className="login-card animate-slide-up">
        {/* Logo */}
        <div className="login-logo">
          <div className="login-logo-icon">S</div>
          <h1 className="text-gradient">ShwePOS</h1>
          <p>{t('loginSubtitle')}</p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={toggleLanguage}
            title={language === 'en' ? t('switchToMyanmar') : t('switchToEnglish')}
            style={{ marginTop: 'var(--space-sm)' }}
          >
            {language === 'en' ? '🇲🇲 MM' : '🇬🇧 EN'}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="login-error animate-fade-in" role="alert">
            {error}
          </div>
        )}

        {/* Session Confirmation Dialog */}
        {showSessionConfirm && (
          <div
            className="animate-fade-in"
            style={{
              padding: 'var(--space-lg)',
              background: 'rgba(255, 193, 7, 0.08)',
              border: '1px solid rgba(255, 193, 7, 0.25)',
              borderRadius: 'var(--radius-lg)',
              marginBottom: 'var(--space-lg)',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>⚠️</div>
            <div style={{ fontWeight: 700, fontSize: 'var(--text-base)', marginBottom: 'var(--space-sm)', color: 'var(--warning)' }}>
              {t('activeSessionDetected')}
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-sm)' }}>
              {t('activeSessionLineOne')}
              <br />
              {t('activeSessionLineTwo')}
            </p>
            {lastLoginInfo && (
              <p style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                background: 'rgba(0,0,0,0.2)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-sm)',
                display: 'inline-block',
                marginBottom: 'var(--space-md)',
              }}>
                🕐 {lastLoginInfo}
              </p>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, padding: '10px' }}
                onClick={() => setShowSessionConfirm(false)}
              >
                {t('cancelLogin')}
              </button>
              <button
                className="btn btn-warning"
                style={{ flex: 1, padding: '10px' }}
                onClick={handleConfirmLogin}
                disabled={isLoading}
              >
                {isLoading ? t('signingIn') : t('continueLogin')}
              </button>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="email">
              {t('emailAddress')}
            </label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="admin@shwepos.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              autoFocus
              disabled={isLoading}
            />
          </div>

          <div className="input-group">
            <label className="input-label" htmlFor="password">
              {t('password')}
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder={t('enterPassword')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-sm">
                <span
                  className="loading-spinner"
                  style={{ width: 18, height: 18, borderWidth: 2 }}
                />
                {t('signingIn')}
              </span>
            ) : (
              t('signIn')
            )}
          </button>
        </form>

        {/* Footer */}
        <p
          style={{
            textAlign: 'center',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
            marginTop: 'var(--space-xl)',
          }}
        >
          ShwePOS v1.0 • © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
