/**
 * Next.js proxy (formerly middleware) — uses lightweight auth config
 * (no Prisma/bcrypt) to stay under Vercel Edge Function 1MB size limit.
 */
import NextAuth from 'next-auth';
import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|api/auth).*)',
  ],
};
