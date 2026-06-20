import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/auth/check-session
 * Verify credentials and check if user has an active session elsewhere.
 * Returns { valid, hasActiveSession, lastLoginAt } without actually logging in.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: (email as string).toLowerCase().trim() },
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

    return NextResponse.json({
      valid: true,
      hasActiveSession,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
