/**
 * Full NextAuth configuration WITH Prisma + bcrypt.
 * Used by API routes and server components (NOT Edge/middleware).
 */
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { authConfig } from '@/lib/auth.config';
import { loginCredentialsSchema } from '@/lib/validations';
import {
  consumeRateLimit,
  getClientIp,
  normalizeRateLimitPart,
  resetRateLimit,
} from '@/lib/rateLimit';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_IP_EMAIL_LIMIT = 10;
const LOGIN_IP_LIMIT = 40;

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
      async authorize(credentials, request) {
        const parsed = loginCredentialsSchema.safeParse({
          email: credentials?.email,
          password: credentials?.password,
        });
        if (!parsed.success) {
          return null;
        }

        const email = normalizeRateLimitPart(parsed.data.email);
        const password = parsed.data.password;
        const clientIp = request?.headers ? getClientIp(request.headers) : 'unknown';

        // Per-IP quota blocks credential stuffing/password spraying across emails,
        // while composite IP+email quota prevents attackers from locking out an
        // admin logging in from a different network/store IP.
        const ipKey = `login:ip:${clientIp}`;
        const ipEmailKey = `login:ip-email:${clientIp}:${email}`;
        const [ipLimit, ipEmailLimit] = await Promise.all([
          consumeRateLimit(ipKey, {
            limit: LOGIN_IP_LIMIT,
            windowMs: LOGIN_WINDOW_MS,
          }),
          consumeRateLimit(ipEmailKey, {
            limit: LOGIN_IP_EMAIL_LIMIT,
            windowMs: LOGIN_WINDOW_MS,
          }),
        ]);

        if (!ipLimit.allowed || !ipEmailLimit.allowed) {
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

        await resetRateLimit(ipEmailKey);

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
