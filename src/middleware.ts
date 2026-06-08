/**
 * Next.js middleware — delegates to NextAuth's authorized callback for route protection.
 * Also adds CSRF origin checking for state-changing requests.
 */
export { auth as middleware } from '@/lib/auth';

export const config = {
  // Match all routes except static assets and API auth routes
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.png|api/auth).*)',
  ],
};
