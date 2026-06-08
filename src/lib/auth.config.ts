/**
 * NextAuth configuration WITHOUT Prisma/bcrypt — Edge-compatible.
 * Used by middleware.ts only (runs on Vercel Edge, max 1MB).
 */
import type { NextAuthConfig } from 'next-auth';

declare module 'next-auth' {
  interface User {
    role: string;
  }
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
    };
  }
}

declare module '@auth/core/jwt' {
  interface JWT {
    id: string;
    role: string;
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.role = token.role;
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
