/**
 * Pure classification helpers for the global navigation & API loading indicator.
 * Keeps background polls silent while surfacing foreground API reads and slow mutations.
 */
export type TrackedRequestKind = 'ignore' | 'read' | 'mutation';

const SILENT_API_PREFIXES = [
  '/api/auth/validate-session',
  '/api/auth/session',
  '/api/auth/csrf',
  '/api/inventory/low-stock-count',
  '/api/promotions/active',
];

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function classifyApiRequest(
  rawUrl: string,
  rawMethod: string | undefined,
  currentOrigin: string
): TrackedRequestKind {
  if (!rawUrl) return 'ignore';
  let parsed: URL;
  try {
    parsed = new URL(rawUrl, currentOrigin);
  } catch {
    return 'ignore';
  }

  if (parsed.origin !== currentOrigin) return 'ignore';
  if (!parsed.pathname.startsWith('/api/')) return 'ignore';

  const method = (rawMethod || 'GET').toUpperCase();

  // Never show loaders for silent background health/session/badge polls
  if (SILENT_API_PREFIXES.some((prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`))) {
    return 'ignore';
  }

  // Silent initial settings hydration on GET; track explicit settings saves (PUT)
  if (parsed.pathname === '/api/settings' && method === 'GET') {
    return 'ignore';
  }

  return MUTATING_METHODS.has(method) ? 'mutation' : 'read';
}

export function isInternalNavigationUrl(
  href: string,
  currentHref: string
): boolean {
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) {
    return false;
  }
  try {
    const current = new URL(currentHref);
    const target = new URL(href, current.origin);
    if (target.origin !== current.origin) return false;
    // Ignore clicking link to the exact same path + search
    if (target.pathname === current.pathname && target.search === current.search) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
