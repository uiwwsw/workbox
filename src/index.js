import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function path(value, name) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\?#\s]/.test(value)) {
    throw new TypeError(`${name} must be a same-origin absolute pathname`);
  }
  const url = new URL(value, 'https://example.invalid');
  if (url.pathname !== value || /%2f|%5c|%2e/i.test(value)) throw new TypeError(`${name} must be a normalized pathname`);
  return value;
}

/** Generate a self-contained classic service worker. No runtime CDN dependency. */
export function createWorker(options) {
  const fallback = path(options?.fallback, 'fallback');
  const scope = path(options.scope ?? '/', 'scope');
  if (!scope.endsWith('/')) throw new TypeError('scope must end with /');
  if (!fallback.startsWith(scope)) throw new TypeError('fallback must be inside scope');
  const assets = [...new Set((options.assets ?? []).map(value => path(value, 'asset')))];
  const timeoutMs = options.timeoutMs ?? 8000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 120000) throw new TypeError('timeoutMs must be 100–120000');
  const namespace = options.namespace ?? 'outage';
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(namespace)) throw new TypeError('invalid namespace');
  const config = { fallback, scope, assets, timeoutMs };
  const revision = createHash('sha256').update(JSON.stringify({ config, version: options.version ?? '1', runtime: '0.1.0' })).digest('hex').slice(0, 16);
  const prefix = `uiwwsw-workbox:${namespace}:${scope}:`;
  return `/* @uiwwsw/workbox — navigation fallback only */\n(${runtime.toString()})(${JSON.stringify({ ...config, prefix, cacheName: prefix + revision })});\n`;
}

function runtime(config) {
  const absolute = value => new URL(value, self.location.origin).href;
  self.addEventListener('install', event => {
    event.waitUntil((async () => {
      // Fetch and validate everything before writing; failed updates preserve the active worker.
      const entries = await Promise.all([config.fallback, ...config.assets].map(async value => {
        const response = await fetch(new Request(absolute(value), { cache: 'reload', credentials: 'omit', redirect: 'error' }));
        if (!response.ok || response.type === 'opaque' || (value === config.fallback && !response.headers.get('content-type')?.includes('text/html'))) {
          throw new Error('Fallback assets must be public, successful responses; fallback must be HTML');
        }
        return [absolute(value), response];
      }));
      const cache = await caches.open(config.cacheName);
      await Promise.all(entries.map(([url, response]) => cache.put(url, response)));
      // Intentionally no skipWaiting: keep the standard service-worker update lifecycle.
    })());
  });
  self.addEventListener('activate', event => {
    event.waitUntil((async () => {
      await Promise.all((await caches.keys()).filter(name => name.startsWith(config.prefix) && name !== config.cacheName).map(name => caches.delete(name)));
      await self.clients.claim();
    })());
  });
  self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
    if (request.mode !== 'navigate') {
      // Only explicitly declared public fallback assets may be served from this cache.
      if (!url.search && config.assets.includes(url.pathname)) {
        event.respondWith(caches.open(config.cacheName).then(async cache => (await cache.match(request.url)) ?? fetch(request)));
      }
      return;
    }
    if (!url.pathname.startsWith(config.scope)) return;
    event.respondWith((async () => {
      const controller = new AbortController();
      let timer;
      try {
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('Navigation timeout')); }, config.timeoutMs);
        });
        const response = await Promise.race([fetch(request, { signal: controller.signal }), timeout]);
        if (response.status < 500 || response.status > 599) return response;
        const cache = await caches.open(config.cacheName);
        return (await cache.match(absolute(config.fallback))) ?? response;
      } catch {
        const cache = await caches.open(config.cacheName);
        return (await cache.match(absolute(config.fallback))) ?? Response.error();
      } finally {
        clearTimeout(timer);
      }
    })());
  });
}

/** Write the generated worker to a site's public directory. */
export async function writeWorker({ outDir, worker = '/outage-sw.js', ...options }) {
  path(worker, 'worker');
  if (!worker.endsWith('.js')) throw new TypeError('worker must end with .js');
  const scope = options.scope ?? '/';
  if (!scope.startsWith(worker.slice(0, worker.lastIndexOf('/') + 1))) throw new TypeError('worker directory must contain scope');
  createWorker(options); // Validate paths before reading any declared public files.
  if (typeof outDir !== 'string' || !outDir) throw new TypeError('outDir is required');
  const digest = createHash('sha256');
  for (const asset of [options.fallback, ...(options.assets ?? [])]) {
    digest.update(asset).update(await readFile(resolve(outDir, '.' + asset)));
  }
  const source = createWorker({ ...options, version: `${options.version ?? '1'}:${digest.digest('hex')}` });
  const output = resolve(outDir, '.' + worker);
  await mkdir(resolve(output, '..'), { recursive: true });
  await writeFile(output, source);
  return output;
}
