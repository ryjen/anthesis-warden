/** Warden is a single-user, unauthenticated local dashboard, not a network API. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function isAllowedDashboardHost(hostHeader: string | undefined): boolean {
  if (!hostHeader || /[\\/\s?#@]/.test(hostHeader)) return false;
  try {
    const url = new URL('http://' + hostHeader);
    return LOOPBACK_HOSTS.has(url.hostname) &&
      !url.username && !url.password && url.pathname === '/' &&
      !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function isAllowedDashboardOrigin(
  hostHeader: string | undefined,
  originHeader: string | undefined,
  fetchSite?: string,
): boolean {
  if (!isAllowedDashboardHost(hostHeader)) return false;
  if (fetchSite === 'cross-site' || fetchSite === 'same-site') return false;
  if (originHeader === undefined) return true;
  try {
    const origin = new URL(originHeader);
    if (!['http:', 'https:'].includes(origin.protocol) ||
        origin.origin !== originHeader || origin.host !== hostHeader) return false;
    return isAllowedDashboardHost(origin.host);
  } catch {
    return false;
  }
}
