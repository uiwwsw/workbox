<div align="center">

<h1>@uiwwsw/workbox</h1>

<p>서버가 응답하지 않을 때 미리 저장해 둔 HTML 안내 페이지를 보여주는 서비스워커를 빌드 시점에 생성합니다.<br>
Generates, at build time, a service worker that shows a pre-cached HTML page when a navigation fails.</p>

<p>
<a href="https://www.npmjs.com/package/@uiwwsw/workbox"><img alt="npm version" src="https://img.shields.io/npm/v/@uiwwsw/workbox?style=flat-square"></a>
<a href="LICENSE"><img alt="license" src="https://img.shields.io/npm/l/@uiwwsw/workbox?style=flat-square"></a>
<a href="https://github.com/uiwwsw/workbox/actions/workflows/test.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/uiwwsw/workbox/test.yml?branch=main&style=flat-square"></a>
<img alt="node" src="https://img.shields.io/node/v/@uiwwsw/workbox?style=flat-square">
<img alt="dependencies: 0" src="https://img.shields.io/badge/dependencies-0-brightgreen?style=flat-square">
<img alt="not affiliated with Google Workbox" src="https://img.shields.io/badge/not%20affiliated%20with-Google%20Workbox-lightgrey?style=flat-square">
</p>

<p>
<a href="https://www.npmjs.com/package/@uiwwsw/workbox">npm</a> ·
<a href="https://github.com/uiwwsw/workbox/blob/main/docs/REFERENCE.md">Reference</a> ·
<a href="https://github.com/uiwwsw/workbox/issues">Issues</a>
</p>

</div>

**Google Workbox(`workbox-*` 패키지)와 관계가 없습니다.** Google이 만들거나 보증하지 않았고 코드도 공유하지 않습니다.
**Not affiliated with Google Workbox (the `workbox-*` packages).** Not made or endorsed by Google; shares no code.

서버가 5xx를 반환하거나 응답하지 않을 때, 이전에 방문한 사용자에게 미리 저장한 HTML 페이지를 보여주는 서비스워커를 만듭니다. 번들러와 의존성 없이 JSON 설정 파일 하나로 동작합니다.
It generates a service worker that serves a pre-cached HTML page to returning visitors when the server fails or does not respond. It needs no bundler and no dependencies, only one JSON config file.

## 장점 / Why use it

- **의존성 0개, 번들러 불필요.** JSON 설정 파일 하나와 `outage-worker` 명령으로 서비스워커를 만듭니다. / Zero runtime dependencies and no bundler: one JSON config and the `outage-worker` command.
- **서버 장애까지 잡습니다.** 네트워크 오류뿐 아니라 타임아웃(기본 8초)과 HTTP 5xx 응답에도 안내 페이지를 보여 줍니다. / Covers server failures too: network errors, timeouts (8 s by default) and HTTP 5xx responses all show the outage page.
- **필요한 것만 저장합니다.** 안내 HTML과 지정한 정적 파일만 캐시하고, 앱 페이지·API 응답·쿠키·로그인한 화면은 저장하지 않습니다. 401·403·404·429와 `/api` 경로는 그대로 통과시킵니다. / Caches only the outage page and the files you list; never app pages, API responses, cookies or signed-in content. 401, 403, 404, 429 and `/api` pass through.
- **기존 서비스워커를 망가뜨리지 않습니다.** 같은 범위에 다른 워커가 있으면 등록하지 않고, `skipWaiting`을 강제하지 않으며, 다른 패키지의 캐시를 지우지 않습니다. / Safe next to existing workers: it refuses to register over another worker's scope, never forces `skipWaiting`, and leaves other caches alone.
- **안내 페이지를 고치면 자동으로 갱신됩니다.** 내용 해시가 캐시 이름에 들어가 새 버전이 새 캐시로 설치됩니다. / Editing the outage page updates it: a content hash in the cache name installs a fresh cache.

## 지금 되는 것 / What works now

- `outage-worker` CLI가 JSON 설정으로 서비스워커 파일을 씁니다. / The `outage-worker` CLI writes the worker file from a JSON config.
- `createWorker`, `writeWorker`: 빌드 스크립트용 Node API. / Node API for build scripts.
- `registerOutageWorker()`: 브라우저 등록. 범위가 겹치는 다른 워커가 있으면 오류를 던집니다. / Browser registration; throws if another worker overlaps the scope.
- 폴백 조건: 네트워크 오류, 타임아웃(기본 8000ms), HTTP 5xx. / Fallback on network error, timeout (default 8000 ms), HTTP 5xx.
- 캐시 대상은 폴백 HTML과 `assets` 목록뿐입니다. / Only the fallback HTML and listed `assets` are cached.
- 401, 403, 404, 429와 `/api` 경로는 통과시킵니다. / 401, 403, 404, 429 and `/api` paths pass through.
- 런타임 의존성 0개, TypeScript 선언 포함. / Zero runtime dependencies, TypeScript declarations included.

## 아직 안 되는 것 / Not done

- 첫 방문은 보호하지 못합니다. 워커가 설치된 뒤의 방문만 대상입니다. / First visits are not covered; only visits after the worker is installed.
- 이미 있는 서비스워커에 합치는 API가 없습니다. / No way to merge into an existing service worker.
- 저장소가 비워지거나 제거된 경우, 서비스워커가 꺼진 경우, HTTP 환경은 안 됩니다. / Cleared or evicted storage, disabled service workers and plain HTTP are not covered.
- 정상 로드된 페이지의 오프라인 저장이 없습니다. / No offline storage of pages that loaded normally.
- 페이지 안의 API 오류와 클라이언트 라우터 전환을 처리하지 않습니다. / No handling of API errors inside loaded pages or client-side router transitions.
- 라우팅, 캐싱 전략, 프리캐싱 API가 없습니다. / No routing, caching strategies or precaching API.
- 공격 방어가 없습니다. / No attack protection.

## 설치 / Install

```sh
npm install @uiwwsw/workbox
```

Node.js 20 이상. / Requires Node.js 20 or newer.

`outage.config.json` (`public/unavailable.html`이 있어야 합니다 / `public/unavailable.html` must exist):

```json
{
  "fallback": "/unavailable.html",
  "outDir": "public"
}
```

빌드 전에 실행 / Run before the build:

```sh
npx outage-worker outage.config.json
```

브라우저 진입점에서 등록 / Register from the browser entry point:

```js
import { registerOutageWorker } from '@uiwwsw/workbox/register';

registerOutageWorker().catch(console.error);
```

## 문서 / Docs

[Reference](https://github.com/uiwwsw/workbox/blob/main/docs/REFERENCE.md): options, behavior, architecture, releases.

## License

MIT. See [LICENSE](LICENSE).
