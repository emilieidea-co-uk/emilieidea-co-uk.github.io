// Prefix app-relative paths once. Astro-generated assets already include BASE_URL.
export function withBase(path: string): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  if (base && (path === base || path.startsWith(`${base}/`))) return path;
  return `${base}/${path.replace(/^\/+/, '')}`;
}

export function absoluteUrl(path: string, site: URL | undefined): string {
  const pathname = withBase(path);
  return site ? new URL(pathname, site).href : pathname;
}
