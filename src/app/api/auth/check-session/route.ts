import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { handleApiError, validateCsrf } from '@/lib/apiAuth';
import {
  consumeRateLimit,
  getClientIp,
  normalizeRateLimitPart,
  resetRateLimit,
} from '@/lib/rateLimit';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_EMAIL_LIMIT = 10;
const LOGIN_IP_LIMIT = 50;

function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Too many login attempts. Please try again later.' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfterSeconds) },
    }
  );
}

/**
 * POST /api/auth/check-session
 * Verify credentials and check if user has an active session elsewhere.
 * Returns { valid, hasActiveSession, lastLoginAt } without actually logging in.
 */
export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const normalizedEmail = normalizeRateLimitPart(email as string);
    const emailKey = `login:email:${normalizedEmail}`;
    const ipKey = `login:ip:${normalizeRateLimitPart(getClientIp(request.headers))}`;
    const emailLimit = consumeRateLimit(emailKey, {
      limit: LOGIN_EMAIL_LIMIT,
      windowMs: LOGIN_WINDOW_MS,
    });
    const ipLimit = consumeRateLimit(ipKey, {
      limit: LOGIN_IP_LIMIT,
      windowMs: LOGIN_WINDOW_MS,
    });

    if (!emailLimit.allowed || !ipLimit.allowed) {
      return rateLimitedResponse(
        Math.max(emailLimit.retryAfterSeconds, ipLimit.retryAfterSeconds)
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        password: true,
        isActive: true,
        sessionVersion: true,
        lastLoginAt: true,
      },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { valid: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { valid: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if there's an active session:
    // sessionVersion > 0 means someone has logged in before
    // lastLoginAt within the last 24 hours means session is likely still active
    const hasActiveSession =
      user.sessionVersion > 0 &&
      user.lastLoginAt !== null &&
      Date.now() - new Date(user.lastLoginAt).getTime() < 24 * 60 * 60 * 1000;

    resetRateLimit(emailKey);
    resetRateLimit(ipKey);

    return NextResponse.json({
      valid: true,
      hasActiveSession,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    });
  } catch (error) {
    return handleApiError(error, 'Failed to check session');
  }
}
