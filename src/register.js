/** Register only when supported; refuse to replace another worker in the same scope. */
export async function registerOutageWorker({ worker = '/outage-sw.js', scope = '/' } = {}) {
  if (typeof window === 'undefined' || !window.isSecureContext || !('serviceWorker' in navigator)) return null;
  const script = new URL(worker, location.origin);
  const scopeUrl = new URL(scope, location.origin);
  if (script.origin !== location.origin || scopeUrl.origin !== location.origin) throw new TypeError('Worker and scope must be same-origin');
  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    const existing = registration.installing ?? registration.waiting ?? registration.active;
    const overlaps = scopeUrl.href.startsWith(registration.scope) || registration.scope.startsWith(scopeUrl.href);
    if (overlaps && existing && existing.scriptURL !== script.href) {
      throw new Error('Existing service worker overlaps this scope; integrate fallback into that worker instead');
    }
  }
  return navigator.serviceWorker.register(script.href, { scope: scopeUrl.href, updateViaCache: 'none' });
}
