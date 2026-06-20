/**
 * NextAuth configuration WITHOUT Prisma/bcrypt — Edge-compatible.
 * Used by proxy.ts only (runs on Vercel Edge, max 1MB).
 */
import type { NextAuthConfig } from 'next-auth';

declare module 'next-auth' {
  interface User {
    role: string;
    sessionVersion?: number;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      sessionVersion: number;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: string;
    sessionVersion: number;
  }
}

export const authConfig: NextAuthConfig = {
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  providers: [], // Providers added in auth.ts (not needed for middleware)
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: string }).role;
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.sessionVersion = token.sessionVersion;
      }
      return session;
    },
    async authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user;
      const isOnLogin = request.nextUrl.pathname === '/login';

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/', request.nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
  },
};

