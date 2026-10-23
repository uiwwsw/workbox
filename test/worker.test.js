import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createWorker } from '../src/index.js';

function setup(options = {}) {
  const handlers = {};
  const stores = new Map();
  let network = async () => new Response('<h1>Unavailable</h1>', { headers: { 'content-type': 'text/html' } });
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return { async put(key, response) { store.set(key, response.clone()); }, async match(key) { return store.get(key)?.clone(); } };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); }
  };
  vm.runInNewContext(createWorker({ fallback: '/unavailable.html', ...options }), {
    self: { location: { origin: 'https://example.test' }, clients: { claim: async () => {} }, addEventListener(type, fn) { handlers[type] = fn; } },
    caches, Request, Response, URL, AbortController, setTimeout, clearTimeout,
    fetch: (...args) => network(...args)
  });
  return {
    stores,
    setNetwork(fn) { network = fn; },
    async lifecycle(type) { let promise; handlers[type]({ waitUntil(p) { promise = p; } }); await promise; },
    async navigate({ pathname = '/', mode = 'navigate', method = 'GET' } = {}) {
      let promise;
      handlers.fetch({ request: { url: 'https://example.test' + pathname, mode, method }, respondWith(p) { promise = p; } });
      return promise;
    }
  };
}

test('caches only the public fallback; healthy navigation is always fresh', async () => {
  const sw = setup(); await sw.lifecycle('install'); await sw.lifecycle('activate');
  sw.setNetwork(async () => new Response('fresh'));
  assert.equal(await (await sw.navigate()).text(), 'fresh');
  assert.equal([...sw.stores.values()][0].size, 1);
});
for (const status of [500, 502, 503, 504, 599]) test(`fallback on ${status}`, async () => {
  const sw = setup(); await sw.lifecycle('install');
  sw.setNetwork(async () => new Response('server error', { status }));
  assert.match(await (await sw.navigate()).text(), /Unavailable/);
});
for (const status of [200, 401, 403, 404, 429]) test(`preserves ${status}`, async () => {
  const sw = setup(); await sw.lifecycle('install');
  sw.setNetwork(async () => new Response('original', { status }));
  assert.equal((await sw.navigate()).status, status);
});
test('fallback on disconnected server and timeout', async () => {
  const sw = setup({ timeoutMs: 100 }); await sw.lifecycle('install');
  sw.setNetwork(async () => { throw new TypeError('offline'); });
  assert.match(await (await sw.navigate()).text(), /Unavailable/);
  sw.setNetwork(() => new Promise(() => {}));
  assert.match(await (await sw.navigate()).text(), /Unavailable/);
});
test('does not intercept API calls, POSTs, or outside scope', async () => {
  const sw = setup({ scope: '/app/', fallback: '/app/unavailable.html' });
  assert.equal(await sw.navigate({ mode: 'cors', pathname: '/api/user' }), undefined);
  assert.equal(await setup().navigate({ pathname: '/api/user' }), undefined);
  assert.equal(await sw.navigate({ method: 'POST' }), undefined);
  assert.equal(await sw.navigate({ pathname: '/other' }), undefined);
});
test('failed or redirected fallback prevents installation', async () => {
  const sw = setup(); sw.setNetwork(async () => new Response('error', { status: 503 }));
  await assert.rejects(sw.lifecycle('install'));
  assert.equal(sw.stores.size, 0);
});
test('HTML required and requests omit credentials', async () => {
  const sw = setup();
  sw.setNetwork(async request => {
    assert.equal(request.credentials, 'omit'); assert.equal(request.redirect, 'error');
    return new Response('{}', { headers: { 'content-type': 'application/json' } });
  });
  await assert.rejects(sw.lifecycle('install'));
});
test('only own obsolete caches are removed', async () => {
  const sw = setup(); await sw.lifecycle('install');
  sw.stores.set('another-app', new Map()); sw.stores.set('uiwwsw-workbox:outage:/:old', new Map());
  await sw.lifecycle('activate');
  assert.ok(sw.stores.has('another-app')); assert.ok(!sw.stores.has('uiwwsw-workbox:outage:/:old'));
});
test('explicit assets are available offline', async () => {
  const sw = setup({ assets: ['/offline.css'] }); await sw.lifecycle('install');
  sw.setNetwork(async () => { throw new Error('offline'); });
  assert.ok(await sw.navigate({ pathname: '/offline.css', mode: 'no-cors' }));
  assert.equal(await sw.navigate({ pathname: '/private.json', mode: 'cors' }), undefined);
});
test('invalid and cross-origin paths fail before generating', () => {
  for (const fallback of ['https://evil.test/', '//evil.test/', '/a/../secret', '/x?token=x', '/%2e%2e/x']) {
    assert.throws(() => createWorker({ fallback }));
  }
  assert.throws(() => createWorker({ fallback: '/offline', scope: '/app/' }));
});
test('cache revision changes with explicit version', () => {
  assert.notEqual(createWorker({ fallback: '/offline', version: '1' }), createWorker({ fallback: '/offline', version: '2' }));
});
