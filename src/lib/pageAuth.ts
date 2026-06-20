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
  if (!session?.user) {
    redirect('/login');
  }

  // Single-session enforcement: check sessionVersion
  const tokenVersion = (session.user as { sessionVersion?: number }).sessionVersion ?? 0;
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { sessionVersion: true },
  });

  if (!dbUser || tokenVersion !== dbUser.sessionVersion) {
    redirect('/login');
  }

  return session;
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
