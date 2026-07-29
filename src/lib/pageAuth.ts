/**
 * Server-side page auth helpers for dashboard route protection.
 * Includes single-session enforcement via sessionVersion check.
 */
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import type { UserRole } from '@/lib/constants';

/**
 * Get session or redirect to login. Use in server components.
 * Also validates sessionVersion to enforce single-session policy.
 */
export async function requirePageAuth() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
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
    redirect('/login');
  }

  // Return database-derived role/name/email so page authorization does not
  // trust stale JWT claims after an admin changes the account.
  return {
    ...session,
    user: {
      ...session.user,
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role as UserRole,
      sessionVersion: dbUser.sessionVersion,
    },
  };
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
