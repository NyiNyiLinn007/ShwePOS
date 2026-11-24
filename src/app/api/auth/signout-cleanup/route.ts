import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { handleApiError, validateCsrf } from '@/lib/apiAuth';

/**
 * POST /api/auth/signout-cleanup
 * Called before signOut to clear the login marker and invalidate the current
 * JWT. This also prevents a copied cookie from being replayed after logout.
 */
export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
  } catch (error) {
    return handleApiError(error, 'Failed to validate request');
  }

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: true });
    }

    const tokenVersion =
      (session.user as { sessionVersion?: number }).sessionVersion ?? 0;

    await prisma.user.updateMany({
      where: {
        id: session.user.id,
        isActive: true,
        sessionVersion: tokenVersion,
      },
      data: {
        lastLoginAt: null,
        sessionVersion: { increment: 1 },
      },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Don't block logout on error
  }
}
