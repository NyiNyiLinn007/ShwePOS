import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/auth/signout-cleanup
 * Called before signOut to clear lastLoginAt.
 * This prevents check-session from falsely detecting an "active session"
 * after the user has properly logged out.
 */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ ok: true });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastLoginAt: null },
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Don't block logout on error
  }
}
