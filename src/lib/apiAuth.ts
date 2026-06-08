/**
 * Server-side API authentication and RBAC helpers.
 * Use these in every API route to enforce auth + role checks.
 */
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';
import type { UserRole } from '@/lib/constants';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export class ApiError {
  constructor(
    public message: string,
    public status: number
  ) {}
}

/**
 * Get authenticated user from session. Throws ApiError(401) if not authenticated.
 */
export async function requireAuth(): Promise<AuthUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ApiError('Authentication required', 401);
  }
  return session.user as AuthUser;
}

/**
 * Get authenticated user and verify role. Throws ApiError(403) if unauthorized.
 */
export async function requireRole(...allowedRoles: string[]): Promise<AuthUser> {
  const user = await requireAuth();
  if (!allowedRoles.includes(user.role)) {
    throw new ApiError('Insufficient permissions', 403);
  }
  return user;
}

/** Role hierarchy: ADMIN > MANAGER > CASHIER */
const ROLE_LEVEL: Record<UserRole, number> = {
  ADMIN: 3,
  MANAGER: 2,
  CASHIER: 1,
};

/**
 * Check if a user role has at least the given minimum role level.
 */
export function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return (ROLE_LEVEL[userRole] || 0) >= (ROLE_LEVEL[minRole] || 0);
}

/**
 * Handle ApiError in catch blocks — returns proper JSON error response.
 */
export function handleApiError(error: unknown, fallbackMessage = 'Internal server error'): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  console.error(fallbackMessage + ':', error);
  const message = error instanceof Error ? error.message : fallbackMessage;
  return NextResponse.json({ error: message }, { status: 500 });
}
