import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/auth/validate-session
 * Lightweight endpoint for client-side session version validation.
 * Returns 200 if session is valid, 401 if stale/expired.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ valid: false }, { status: 401 });
    }

    const tokenVersion = (session.user as { sessionVersion?: number }).sessionVersion ?? 0;

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { sessionVersion: true },
    });

    if (!user || tokenVersion !== user.sessionVersion) {
      return NextResponse.json(
        { valid: false, reason: 'Session expired — logged in from another device' },
        { status: 401 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
