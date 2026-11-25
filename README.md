# @uiwwsw/workbox

기존 방문자에게 서버 장애 시 미리 저장한 안내 페이지를 보여주는 작은 서비스워커 패키지입니다. Google Workbox와 별개의 프로젝트입니다.

A navigation-only outage fallback for returning visitors. It does not cache application pages, API responses, credentials, or personal data.

## Install

```sh
npm install @uiwwsw/workbox
```

Create a public, self-contained static HTML page at `public/unavailable.html`. Use inline CSS or declare its public dependencies in `assets`. Avoid remote fonts, scripts and authenticated resources: they may be unreachable during an outage.

Create `outage.config.json`:

```json
{
  "fallback": "/unavailable.html",
  "outDir": "public"
}
```

Generate before the application's build:

```sh
npx outage-worker outage.config.json
```

Register from the browser entry point:

```js
import { registerOutageWorker } from '@uiwwsw/workbox/register';

registerOutageWorker().catch(console.error);
```

For static sites without a bundler, copy `src/register.js` from the installed package into the site's static assets and import it locally. Serve the generated worker from the same origin as the site, with a JavaScript content type and `Cache-Control: no-cache`. Exclude the worker from SPA HTML rewrites. Keep registration failures observable without blocking application startup.

## Options

| Option | Default | Meaning |
| --- | --- | --- |
| `fallback` | required | Same-origin absolute path to public static HTML |
| `outDir` | required for CLI | Public output directory, relative to working directory |
| `worker` | `/outage-sw.js` | Generated worker pathname |
| `scope` | `/` | Controlled pathname prefix, ending with `/` |
| `assets` | `[]` | Public CSS, font or image paths required by the fallback |
| `timeoutMs` | `8000` | Navigation timeout, 100–120000 milliseconds |
| `namespace` | `outage` | Cache isolation identifier |
| `version` | `1` | Optional release identifier; CLI also hashes local HTML/assets |

For a subpath deployment, set `scope` and `fallback` to that subpath and pass matching `scope` and `worker` options to registration. Place the worker at or above the scope directory.

The CLI validates that declared public files exist and automatically revisions their cache when their contents change.

The Node API exports `createWorker(options)` and `writeWorker(options)` for build integrations. Browser registration is a separate export, so Node built-ins never enter the client bundle.

## Behavior and limits

- Only same-origin GET navigations inside scope receive outage fallback on network failure, timeout or HTTP 500–599. Original 401/403/404/429 responses are preserved.
- Only the fallback and explicitly listed public assets are cached. Initial caching omits credentials and rejects redirects and unsuccessful responses. The fallback must be HTML.
- HTTPS and a successful prior installation are required. First visits, cleared/evicted storage, private browsing restrictions and disabled service workers cannot be protected.
- Existing pages' API errors and client-side router transitions need application UI handling. This package does not replace that handling or provide attack protection.
- Registration refuses overlapping existing workers. Integrate with an existing PWA worker rather than replacing it; do not add a second competing worker.
- Updates follow the standard waiting lifecycle. No forced `skipWaiting`, mass unregister or deletion of other packages' caches occurs. Close old tabs to finish activating a waiting update.
- Retry the original URL from the fallback (for example, a normal reload button). Avoid automatic reload loops or redirecting to the fallback URL.
- Removing registration code does not uninstall an existing worker. Roll back by serving a network-only worker at the same URL and releasing it through the normal update lifecycle before removing that URL.

## 구성 / Architecture

의존성이 없는 패키지입니다. `dependencies`가 비어 있고, Node.js 내장 모듈(`node:crypto`, `node:fs/promises`, `node:path`)과 브라우저 표준 API만 씁니다. 생성된 워커도 외부 스크립트를 불러오지 않습니다.
The package has no dependencies. It uses only Node.js built-ins (`node:crypto`, `node:fs/promises`, `node:path`) and standard browser APIs. The generated worker loads no external script.

### `src/` 파일 / Files in `src/`

| File | Role |
| --- | --- |
| `index.js` | Node API. `createWorker(options)` validates the options and returns the worker source as a string. `writeWorker(options)` hashes the fallback page and declared assets, passes the hash to `createWorker` as part of `version`, and writes the result to `outDir`. The worker's runtime code is a function in this file that is serialized into the output with `Function.prototype.toString`. |
| `index.d.ts` | TypeScript declarations for `createWorker`, `writeWorker` and `registerOutageWorker`. |
| `cli.js` | The `outage-worker` command. Reads one JSON config file and calls `writeWorker`; prints the output path, or an error message with exit code 1. |
| `register.js` | Browser-side `registerOutageWorker()`. Returns `null` outside a secure context or without service worker support. Throws if another worker with an overlapping scope is already registered from a different script URL. Otherwise calls `navigator.serviceWorker.register` with `updateViaCache: 'none'`. |
| `register.d.ts` | Type declaration for `registerOutageWorker`. |

`test/` holds the Node test runner suites (`node --test`) for the generator, the generated worker's behavior and the registration function.

### 서비스워커 동작 / What the generated worker does

1. **Build.** `outage-worker` (or `writeWorker`) reads the fallback HTML and each declared asset from `outDir`, hashes their paths and contents together with the options, and embeds that hash in the cache name (`uiwwsw-workbox:<namespace>:<scope>:<hash>`). A content change therefore produces a new cache name.
2. **install.** The worker fetches the fallback page and every declared asset with `cache: 'reload'`, `credentials: 'omit'` and `redirect: 'error'`. If any response is not OK, is opaque, or (for the fallback) is not `text/html`, installation fails and the previously active worker keeps running. Only when all fetches succeed are the responses written to the new cache. It does not call `skipWaiting()`, so a new version waits until old tabs close.
3. **activate.** The worker deletes caches whose names start with its own prefix but differ from the current cache name, then calls `clients.claim()`. Caches created by other code are not touched.
4. **fetch.** Requests that are not same-origin GET, or whose path is `/api` or starts with `/api/`, are passed through untouched. For the remaining requests:
   - Navigation requests inside `scope` are fetched from the network with a timeout (`timeoutMs`). A response with status below 500 or above 599 is returned as is (including 401, 403, 404 and 429). A network error, a timeout or a 5xx status returns the cached fallback page; if the cache has no entry, the 5xx response is returned, or a network error is surfaced.
   - A non-navigation request is answered from the cache only if its path exactly matches a declared asset and has no query string; if the cache has no entry it goes to the network.
   - Everything else is left to the browser's default handling.
5. **What is cached.** Only the fallback page and the declared assets. Application pages, API responses, cookies and authenticated content are never written to the cache. Pages that loaded successfully are not stored for later offline use.

### 관련 프로젝트와 표준 / Related projects and standards

- **Google Workbox** ([GoogleChrome/workbox](https://github.com/GoogleChrome/workbox), [documentation](https://developer.chrome.com/docs/workbox/), MIT) is a separate, widely used set of service worker libraries (`workbox-*` on npm). This package is not affiliated with Google and does not use Workbox code. The name was chosen independently and collides with it; see the note below.
- **Workbox's offline fallback recipe.** The [`offlineFallback` recipe](https://developer.chrome.com/docs/workbox/modules/workbox-recipes#offline_fallback) in `workbox-recipes` serves a page, image or font when a routed request fails, for example when the user is offline. For the core case of showing a prepared HTML page when a navigation fails, it does the same job as this package. If your site already uses Google Workbox, use its `offlineFallback` recipe and skip this package. The differences here are small and specific: the page is cached at install time from a build step, a navigation timeout and HTTP 5xx responses also trigger the fallback, `/api` paths are excluded, and `registerOutageWorker` refuses to register next to a different worker in the same scope. Whether the Workbox recipe can be configured to treat 5xx responses and timeouts the same way depends on the route strategy you pair it with; that was not tested here.
- **Standards and guides.** The worker is a plain [Service Worker](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) ([specification](https://w3c.github.io/ServiceWorker/)) that stores responses with the [Cache Storage API](https://developer.mozilla.org/en-US/docs/Web/API/CacheStorage). The update behavior follows the [service worker lifecycle](https://web.dev/articles/service-worker-lifecycle), and the approach of serving a stored page when the network fails is one of the patterns in the [Offline Cookbook](https://web.dev/articles/offline-cookbook).

### 이름 충돌 주의 / Name collision

This package is published as `@uiwwsw/workbox`. Google's libraries use the names `workbox-build`, `workbox-sw`, `workbox-recipes`, `workbox-window` and other `workbox-*` packages. The scope `@uiwwsw/` separates the npm names, but searches for "workbox" and import statements in documentation can point to either. Check the scope when installing, and do not expect Google Workbox's API (`registerRoute`, strategies, precaching) here: this package exports only `createWorker`, `writeWorker` and `registerOutageWorker`.

## Development

Node.js 20 or newer; no runtime dependencies.

```sh
npm test
npm pack --dry-run
```

## Releases

The `Publish npm` GitHub Actions workflow publishes from `main` using npm Trusted Publishing (OIDC). It requires no stored npm publishing token. Configure the package's trusted publisher with the repository owner and name, workflow filename `publish.yml`, and direct publishing permission. The workflow uses no GitHub environment binding.

For a new package, first use npm staged publishing and approve the initial version on npmjs.com. Once the package exists, configure its trusted publisher. Commit a new package version, then manually run the workflow from `main`. The workflow checks the package, inspects its contents and publishes with provenance. Run its first OIDC release within two days of configuring the trust relationship.

## License

MIT. See [LICENSE](LICENSE).
