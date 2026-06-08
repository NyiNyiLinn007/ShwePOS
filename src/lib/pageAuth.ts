/**
 * Server-side page auth helpers for dashboard route protection.
 */
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import type { UserRole } from '@/lib/constants';

/**
 * Get session or redirect to login. Use in server components.
 */
export async function requirePageAuth() {
  const session = await auth();
  if (!session?.user) {
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
