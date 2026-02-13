# ngx-local-storage-broker

<img src="https://github.com/Ngx-Workshop/.github/blob/main/readme-assets/angular-gradient-wordmark.gif?raw=true" height="132" alt="Angular Logo" />

Cross-origin localStorage access using a secure iframe broker + Angular client library.

This repository contains **two parts**:

1. **Angular library** (`ngx-local-storage-client`) used by host/remotes to call a broker.
2. **Broker runtime** (`ngx-broker`) served on the storage-owning origin and embedded as an iframe.

## Why this exists

Browsers scope `localStorage` per origin. If your app is split across domains/subdomains (for example MFEs), direct access to another origin's storage is not possible. This project provides a `postMessage` bridge so applications can read/write storage through an allowed iframe host.

## Repository structure

```text
projects/ngx-local-storage-client/
	src/lib/local-storage-broker.service.ts   # Angular API for get/set/remove/clear/keys
	src/lib/tokens.ts                         # DI config token + provider helper
ngx-broker/
	broker.ts                                 # postMessage protocol + localStorage operations
	index.html                                # broker iframe page (loads bundled script)
```

## How it works

1. Angular app injects `LocalStorageBrokerService`.
2. Service creates a hidden iframe pointing to the broker page.
3. Service sends `postMessage` requests (`get`, `set`, `remove`, `clear`, `keys`).
4. Broker validates parent origin, executes localStorage operation, and replies.
5. Service resolves/rejects a Promise per request with timeout protection.

Communication channel: `ngx-ls-broker`.

## Part 1: Angular library (`ngx-local-storage-client`)

### Public API

- `provideLocalStorageBroker(config)`
- `LocalStorageBrokerService`
  - `getItem(key): Promise<string | null>`
  - `setItem(key, value): Promise<true>`
  - `removeItem(key): Promise<true>`
  - `clearNamespace(): Promise<true>`
  - `keys(): Promise<string[]>`

### Configure in an Angular app

```ts
import { ApplicationConfig } from '@angular/core';
import { provideLocalStorageBroker } from 'ngx-local-storage-client';

export const appConfig: ApplicationConfig = {
  providers: [
    ...provideLocalStorageBroker({
      iframeUrl:
        'https://auth.ngx-workshop.io/assets/ngx-local-storage-broker.html',
      brokerOrigin: 'https://auth.ngx-workshop.io',
      namespace: 'mfe-remotes',
      requestTimeoutMs: 2000,
    }),
  ],
};
```

Use from any service/component:

```ts
import { Injectable, inject } from '@angular/core';
import { LocalStorageBrokerService } from 'ngx-local-storage-client';

@Injectable({ providedIn: 'root' })
export class TokenStore {
  private readonly broker = inject(LocalStorageBrokerService);

  saveToken(token: string) {
    return this.broker.setItem('token', token);
  }

  readToken() {
    return this.broker.getItem('token');
  }
}
```

## Part 2: Broker runtime (`ngx-broker`)

### Responsibilities

- Accept `postMessage` requests from allowed parent origins only.
- Execute localStorage operations in broker origin.
- Return structured success/error responses.
- Support namespaced key handling (`namespace:key`).

### Security model

The broker enforces origin allowlisting in `ngx-broker/broker.ts`:

```ts
const ALLOWED_PARENT_ORIGINS = new Set<string>([
  'http://localhost',
  'https://beta.ngx-workshop.io',
  'https://admin.ngx-workshop.io',
  'https://auth.ngx-workshop.io',
]);
```

Before deployment, update this list to your exact parent origins.

### Message protocol (high level)

- Request envelope:
  - `channel: 'ngx-ls-broker'`
  - `kind: 'request'`
  - `id`, `action`, optional `key`, `value`, `namespace`
- Response envelope:
  - `channel: 'ngx-ls-broker'`
  - `kind: 'response'`
  - `id`, `success`, optional `value` or `error`
- Handshake:
  - `ping` → `pong`

## Build and run

Install dependencies:

```bash
npm install
```

Run dev server:

```bash
npm start
```

Build Angular library only:

```bash
npm run ngx-local-storage-client:build
```

Build broker script only:

```bash
npm run build:broker
```

Copy broker HTML into `dist`:

```bash
npm run copy:broker:html
```

Build everything:

```bash
npm run build
```

Build outputs:

- Library package: `dist/ngx-local-storage-client/`
- Broker script: `dist/ngx-broker/ngx-local-storage-broker.js`
- Broker HTML: `dist/ngx-broker/ngx-local-storage-broker.html`

## Deployment notes

1. Host `ngx-local-storage-broker.html` and `ngx-local-storage-broker.js` on the broker origin.
2. Ensure Angular clients use:
   - `iframeUrl` = full URL to hosted broker HTML
   - `brokerOrigin` = exact origin of broker host
3. Keep `ALLOWED_PARENT_ORIGINS` minimal and explicit.
4. Use a namespace to avoid key collisions across applications.

## Operational caveats

- `clearNamespace()` requires a non-empty namespace (enforced by broker).
- Requests time out (default 2000 ms) if broker is unreachable/unresponsive.
- Values are stored as strings (matching Web Storage behavior).
- `http://localhost` allowlisting is useful for local testing but should be removed or tightened for production.
