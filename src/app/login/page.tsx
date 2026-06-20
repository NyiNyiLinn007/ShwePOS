'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
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
        force: 'true',
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid email or password. Please try again.');
      } else if (result?.ok) {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setShowSessionConfirm(false);

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1: Check if user has an active session elsewhere
      const checkRes = await fetch('/api/auth/check-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const checkData = await checkRes.json();

      if (!checkRes.ok || !checkData.valid) {
        setError('Invalid email or password. Please try again.');
        setIsLoading(false);
        return;
      }

      if (checkData.hasActiveSession) {
        // Show confirmation dialog
        const loginTime = checkData.lastLoginAt
          ? new Date(checkData.lastLoginAt).toLocaleString('en-US', {
              timeZone: 'Asia/Yangon',
              dateStyle: 'medium',
              timeStyle: 'short',
            })
          : null;
        setLastLoginInfo(loginTime);
        setShowSessionConfirm(true);
        setIsLoading(false);
        return;
      }

      // No active session — login directly
      await doLogin();
    } catch {
      setError('An unexpected error occurred. Please try again.');
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
          <p>Enterprise Point of Sale System</p>
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
              Active Session Detected
            </div>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-sm)' }}>
              ဒီ account ကို အခြား device/browser မှာ login ဝင်ထားပါတယ်။
              <br />
              ဆက်ဝင်ရင် အဟောင်းက auto logout ဖြစ်ပါမယ်။
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
                ပယ်ဖျက် / Cancel
              </button>
              <button
                className="btn btn-warning"
                style={{ flex: 1, padding: '10px' }}
                onClick={handleConfirmLogin}
                disabled={isLoading}
              >
                {isLoading ? 'Signing in...' : 'ဆက်ဝင်ရန် / Continue'}
              </button>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label className="input-label" htmlFor="email">
              Email Address
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
              Password
            </label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isLoading || showSessionConfirm}
          >
            {isLoading ? (
              <span className="flex items-center gap-sm">
                <span
                  className="loading-spinner"
                  style={{ width: 18, height: 18, borderWidth: 2 }}
                />
                Signing in...
              </span>
            ) : (
              'Sign In'
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
