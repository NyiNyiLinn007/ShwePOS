'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { SessionProvider } from 'next-auth/react';
import Sidebar from '@/components/layout/Sidebar';
import { SettingsInitializer } from '@/components/SettingsInitializer';
import { useRefreshOnFocus } from '@/hooks/useRefreshOnFocus';
import type { UserRole } from '@/lib/constants';

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Auto-refresh server data when tab regains focus
  useRefreshOnFocus();

  // Single-session enforcement: validate sessionVersion
  const validateSession = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const res = await fetch('/api/auth/validate-session');
      if (res.status === 401) {
        // Session is stale — another device logged in
        await signOut({ redirectTo: '/login' });
      }
    } catch {
      // Network error — ignore, will retry on next focus
    }
  }, [session?.user?.id]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Check session version on mount and on tab focus
  useEffect(() => {
    if (status !== 'authenticated') return;

    // Check on mount
    validateSession();

    // Check when tab regains focus
    const handleFocus = () => validateSession();
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [status, validateSession]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (!mounted || status === 'loading') {
    return (
      <div className="loading-page" style={{ minHeight: '100vh' }}>
        <div className="loading-spinner" />
        <span>Loading ShwePOS...</span>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) {
    return null;
  }

  return (
    <div className="app-layout">
      <SettingsInitializer />
      <Sidebar
        userName={session.user.name ?? 'User'}
        userRole={(session.user.role as UserRole) ?? 'CASHIER'}
        userEmail={session.user.email ?? ''}
      />
      <main className="main-content">{children}</main>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <DashboardContent>{children}</DashboardContent>
    </SessionProvider>
  );
}
