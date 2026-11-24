'use client';

import { useEffect, useCallback, useRef } from 'react';
import { SessionProvider, signOut } from 'next-auth/react';
import type { Session } from 'next-auth';
import Sidebar from '@/components/layout/Sidebar';
import { SettingsInitializer } from '@/components/SettingsInitializer';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import type { UserRole } from '@/lib/constants';

const SESSION_CHECK_THROTTLE_MS = 30_000;

interface DashboardShellProps {
  session: Session & {
    user: {
      id: string;
      name: string;
      email: string;
      role: UserRole;
    };
  };
  children: React.ReactNode;
}

function DashboardShellInner({ session, children }: DashboardShellProps) {
  const lastValidateRef = useRef<number>(Date.now());

  // Auto-refresh server data when tab regains visibility/focus (debounced 30s)
  useRefreshOnFocus();

  // Single-session enforcement: validate sessionVersion when tab regains focus
  const validateSession = useCallback(async () => {
    const now = Date.now();
    if (now - lastValidateRef.current < SESSION_CHECK_THROTTLE_MS) return;
    lastValidateRef.current = now;
    try {
      const res = await fetch('/api/auth/validate-session');
      if (res.status === 401) {
        await signOut({ redirectTo: '/login?reason=session_expired' });
      }
    } catch {
      // Network error — ignore, will retry on next focus
    }
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      void validateSession();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void validateSession();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [validateSession]);

  return (
    <div className="app-layout">
      <SettingsInitializer />
      <Sidebar
        userName={session.user.name}
        userRole={session.user.role}
        userEmail={session.user.email}
      />
      <main className="main-content">{children}</main>
    </div>
  );
}

export function DashboardShell({ session, children }: DashboardShellProps) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <DashboardShellInner session={session}>{children}</DashboardShellInner>
    </SessionProvider>
  );
}
