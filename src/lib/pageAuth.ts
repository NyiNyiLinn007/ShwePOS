/**
 * Server-side page auth helpers for dashboard route protection.
 * Includes single-session enforcement via sessionVersion check.
 */
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { UserRole } from '@/lib/constants';

/**
 * Per-request memoized session + DB user verification so (dashboard)/layout.tsx
 * and child page.tsx share a single auth() + prisma.user.findUnique() round-trip
 * without caching across requests or weakening single-session revocation.
 */
const getVerifiedPageSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    return { status: 'unauthenticated' as const };
  }

  const tokenVersion = (session.user as { sessionVersion?: number }).sessionVersion ?? 0;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      sessionVersion: true,
    },
  });

  if (!dbUser || !dbUser.isActive || tokenVersion !== dbUser.sessionVersion) {
    return { status: 'expired' as const };
  }

  return {
    status: 'ok' as const,
    session: {
      ...session,
      user: {
        ...session.user,
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role as UserRole,
        sessionVersion: dbUser.sessionVersion,
      },
    },
  };
});

/**
 * Get session or redirect to login. Use in server components.
 * Also validates sessionVersion to enforce single-session policy.
 */
export async function requirePageAuth() {
  const result = await getVerifiedPageSession();
  if (result.status === 'unauthenticated') {
    redirect('/login');
  }
  if (result.status === 'expired') {
    redirect('/login?reason=session_expired');
  }
  return result.session;
}

/**
 * Get session and check role, or redirect to dashboard with error.
 * Use in server components for role-gated pages.
 */
export async function requirePageRole(...allowedRoles: UserRole[]) {
  const session = await requirePageAuth();
  const userRole = session.user.role as UserRole;
  if (!allowedRoles.includes(userRole)) {
    redirect('/');
  }
  return session;
}
