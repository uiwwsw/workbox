import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const source = (await readFile(new URL('../src/register.js', import.meta.url), 'utf8')).replace('export async', 'async');
function setup(registrations = []) {
  let call;
  const context = vm.createContext({ URL, window: { isSecureContext: true }, location: { origin: 'https://example.test' }, navigator: { serviceWorker: {
    getRegistrations: async () => registrations,
    register: async (...args) => { call = args; return 'registered'; }
  } } });
  vm.runInContext(source, context);
  return { register: options => context.registerOutageWorker(options), call: () => call };
}
test('registers same-origin worker with update cache disabled', async () => {
  const sw = setup(); assert.equal(await sw.register(), 'registered');
  assert.equal(sw.call()[0], 'https://example.test/outage-sw.js'); assert.equal(sw.call()[1].updateViaCache, 'none');
});
test('refuses another active PWA worker', async () => {
  const sw = setup([{ scope: 'https://example.test/', active: { scriptURL: 'https://example.test/pwa.js' } }]);
  await assert.rejects(sw.register(), /Existing service worker/); assert.equal(sw.call(), undefined);
});
test('permits updating this worker', async () => {
  const sw = setup([{ scope: 'https://example.test/', active: { scriptURL: 'https://example.test/outage-sw.js' } }]);
  assert.equal(await sw.register(), 'registered');
});
test('refuses cross-origin worker and scope', async () => {
  await assert.rejects(setup().register({ worker: 'https://other.test/sw.js' }), /same-origin/);
  await assert.rejects(setup().register({ scope: 'https://other.test/' }), /same-origin/);
});
test('SSR returns null', async () => {
  const context = vm.createContext({}); vm.runInContext(source, context);
  assert.equal(await context.registerOutageWorker(), null);
});
