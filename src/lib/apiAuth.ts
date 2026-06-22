/**
 * Server-side API authentication and RBAC helpers.
 * Use these in every API route to enforce auth + role checks.
 */
import { auth } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { ZodError } from 'zod';
import type { UserRole } from '@/lib/constants';

function hostFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeHost(value: string | null): string | null {
  const host = value?.split(',')[0]?.trim().toLowerCase();
  return host || null;
}

function isLocalHost(host: string | null): boolean {
  return !!host && (
    host.startsWith('localhost') ||
    host.startsWith('127.0.0.1') ||
    host.startsWith('[::1]')
  );
}

/**
 * Validate Origin/Referer for CSRF protection on state-changing requests.
 * Call this in POST/PUT/PATCH/DELETE handlers before processing.
 */
export async function validateCsrf(request?: NextRequest): Promise<void> {
  const headersList = request?.headers ?? await headers();
  const origin = headersList.get('origin');
  const referer = headersList.get('referer');

  if (!origin && !referer) {
    if (process.env.NODE_ENV !== 'production') return;
    throw new ApiError('Forbidden: missing origin', 403);
  }

  const sourceHost = hostFromUrl(origin) ?? hostFromUrl(referer);
  if (!sourceHost) {
    throw new ApiError('Forbidden: invalid origin', 403);
  }

  const allowedHosts = new Set<string>();
  const requestHost =
    normalizeHost(headersList.get('x-forwarded-host')) ??
    normalizeHost(headersList.get('host'));
  const configuredHost = hostFromUrl(process.env.NEXTAUTH_URL ?? null);

  if (requestHost) allowedHosts.add(requestHost);
  if (configuredHost) allowedHosts.add(configuredHost);

  if (allowedHosts.has(sourceHost)) return;

  if (process.env.NODE_ENV !== 'production' && isLocalHost(sourceHost) && isLocalHost(requestHost)) {
    return;
  }

  throw new ApiError('Forbidden: invalid origin', 403);
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export class ApiError extends Error {
  public status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

/**
 * In-memory cache for session version validation.
 * Avoids hitting DB on every API request. TTL: 30 seconds.
 */
const sessionVersionCache = new Map<string, { version: number; expiry: number }>();
const CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Get authenticated user from session. Throws ApiError(401) if not authenticated.
 * Also validates sessionVersion to enforce single-session policy.
 */
export async function requireAuth(): Promise<AuthUser> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ApiError('Authentication required', 401);
  }

  // Validate sessionVersion (single-session enforcement)
  const userId = session.user.id;
  const tokenVersion = (session.user as { sessionVersion?: number }).sessionVersion ?? 0;

  // Check cache first
  const cached = sessionVersionCache.get(userId);
  const now = Date.now();

  let dbVersion: number;
  if (cached && cached.expiry > now) {
    dbVersion = cached.version;
  } else {
    // Lazy import to avoid circular dependency issues
    const { prisma } = await import('@/lib/prisma');
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { sessionVersion: true },
    });
    dbVersion = user?.sessionVersion ?? 0;
    sessionVersionCache.set(userId, { version: dbVersion, expiry: now + CACHE_TTL_MS });
  }

  if (tokenVersion !== dbVersion) {
    throw new ApiError('Session expired — logged in from another device', 401);
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
 * Handle ApiError, ZodError, and generic errors in catch blocks.
 * Returns proper JSON error response with appropriate status codes.
 */
export function handleApiError(error: unknown, fallbackMessage = 'Internal server error'): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation failed', details: error.issues },
      { status: 400 }
    );
  }
  console.error(fallbackMessage + ':', error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
