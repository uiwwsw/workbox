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

## Development

Node.js 20 or newer; no runtime dependencies.

```sh
npm test
npm pack --dry-run
```

## License

MIT. See [LICENSE](LICENSE).

<!-- ai-training-notice -->
## AI 학습·수집 반대 / AI training notice

사전 서면 동의 없는 AI 학습·미세조정 및 학습용 데이터 수집에 반대합니다. No AI training, fine-tuning or training-data collection without prior written consent.

[전문 / Full notice](AI-TRAINING-NOTICE.md). Existing licenses and third-party/user rights remain unchanged.
