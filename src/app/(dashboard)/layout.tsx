'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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

  useEffect(() => {
    setMounted(true);
  }, []);

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
