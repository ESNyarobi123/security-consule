/** Portal base URLs for executive deep-links (env-first; host-aware fallback). */

function trimSlash(value: string): string {
  return value.replace(/\/$/, '');
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0'
  );
}

function safeUrl(value?: string): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function deriveSiblingBase(
  targetSubdomain: string,
  fallbackPort: number,
  explicitEnv?: string,
): string {
  const explicit = safeUrl(explicitEnv);

  if (typeof window !== 'undefined') {
    const current = new URL(window.location.origin);

    if (explicit) {
      // Ignore localhost-style env defaults when the current app is already on a non-local host.
      if (!(isLocalHost(explicit.hostname) && !isLocalHost(current.hostname))) {
        return trimSlash(explicit.toString());
      }
    }

    if (isLocalHost(current.hostname)) {
      return `http://localhost:${fallbackPort}`;
    }

    const parts = current.hostname.split('.');
    const domain =
      parts.length >= 3 ? parts.slice(1).join('.') : current.hostname;
    return `${current.protocol}//${targetSubdomain}.${domain}`;
  }

  if (explicit) return trimSlash(explicit.toString());
  return `http://localhost:${fallbackPort}`;
}

function joinPath(base: string, path = ''): string {
  const root = trimSlash(base);
  if (!path) return root;
  return `${root}${path.startsWith('/') ? path : `/${path}`}`;
}

export function adminWebUrl(path = ''): string {
  return joinPath(
    deriveSiblingBase(
      'web',
      3020,
      process.env.NEXT_PUBLIC_ADMIN_WEB_URL,
    ),
    path,
  );
}

export function parkingWebUrl(path = ''): string {
  return joinPath(
    deriveSiblingBase(
      'parking',
      3006,
      process.env.NEXT_PUBLIC_PARKING_WEB_URL,
    ),
    path,
  );
}
