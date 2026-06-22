/**
 * Full NextAuth configuration WITH Prisma + bcrypt.
 * Used by API routes and server components (NOT Edge/middleware).
 */
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/auth.config';
import {
  consumeRateLimit,
  normalizeRateLimitPart,
  resetRateLimit,
} from '@/lib/rateLimit';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_EMAIL_LIMIT = 10;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        force: { label: 'Force', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = normalizeRateLimitPart(credentials.email as string);
        const password = credentials.password as string;
        const emailKey = `login:email:${email}`;
        const emailLimit = consumeRateLimit(emailKey, {
          limit: LOGIN_EMAIL_LIMIT,
          windowMs: LOGIN_WINDOW_MS,
        });

        if (!emailLimit.allowed) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await compare(password, user.password);

        if (!isPasswordValid) {
          return null;
        }

        // Bump sessionVersion and update lastLoginAt on every successful login
        // This invalidates any existing JWT tokens with older sessionVersion
        const updated = await prisma.user.update({
          where: { id: user.id },
          data: {
            sessionVersion: { increment: 1 },
            lastLoginAt: new Date(),
          },
        });

        resetRateLimit(emailKey);

        return {
          id: updated.id,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          sessionVersion: updated.sessionVersion,
        };
      },
    }),
  ],
});
