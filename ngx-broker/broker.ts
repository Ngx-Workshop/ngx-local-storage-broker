// broker/broker.ts
const CHANNEL = 'ngx-ls-broker';
const VERSION = '1.0.0';

// Edit to match your environments:
const ALLOWED_PARENT_ORIGINS = new Set<string>([
  'http://localhost:4200', // shell local
  'http://localhost:4201', // remote local
  'http://localhost:4202', // extra local
  'https://proxy.ngx-workshop.io',
  'https://mfe-orchestrator.ngx-workshop.io',
  // add any other subdomains that will embed this iframe
]);

type RequestMsg =
  | { channel: typeof CHANNEL; kind: 'ping' }
  | {
      channel: typeof CHANNEL;
      kind: 'request';
      id: string;
      action: 'get' | 'set' | 'remove' | 'clear' | 'keys';
      key?: string;
      value?: string | null;
      namespace?: string;
    };

type ResponseMsg =
  | { channel: typeof CHANNEL; kind: 'pong'; version: string }
  | {
      channel: typeof CHANNEL;
      kind: 'response';
      id: string;
      success: boolean;
      value?: unknown;
      error?: string;
    };

function namespacedKey(key: string, ns?: string) {
  return ns ? `${ns}:${key}` : key;
}

function reply(event: MessageEvent, msg: ResponseMsg | ResponseMsg) {
  (event.source as WindowProxy | null)?.postMessage(
    msg,
    event.origin
  );
}

// Handshake: let parent know we’re alive asap
try {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window.parent as any)?.postMessage(
    { channel: CHANNEL, kind: 'pong', version: VERSION },
    '*'
  );
} catch {
  /* noop */
}

window.addEventListener('message', (event: MessageEvent) => {
  if (!event.data || typeof event.data !== 'object') return;
  const data = event.data as RequestMsg;
  if (
    !ALLOWED_PARENT_ORIGINS.has(event.origin) ||
    (data as any).channel !== CHANNEL
  )
    return;

  if (data.kind === 'ping') {
    console.log('[broker] ping received from', event.origin);
    reply(event, {
      channel: CHANNEL,
      kind: 'pong',
      version: VERSION,
    });
    return;
  }

  if (data.kind === 'request') {
    console.log(
      `[broker] received request from ${event.origin}`,
      data
    );
    const { id, action, key, value, namespace } = data;

    try {
      switch (action) {
        case 'get': {
          if (!key) throw new Error('Missing key');
          const v = localStorage.getItem(
            namespacedKey(key, namespace)
          );
          reply(event, {
            channel: CHANNEL,
            kind: 'response',
            id,
            success: true,
            value: v,
          });
          return;
        }
        case 'set': {
          if (!key) throw new Error('Missing key');
          localStorage.setItem(
            namespacedKey(key, namespace),
            value ?? ''
          );
          reply(event, {
            channel: CHANNEL,
            kind: 'response',
            id,
            success: true,
            value: true,
          });
          return;
        }
        case 'remove': {
          if (!key) throw new Error('Missing key');
          localStorage.removeItem(namespacedKey(key, namespace));
          reply(event, {
            channel: CHANNEL,
            kind: 'response',
            id,
            success: true,
            value: true,
          });
          return;
        }
        case 'clear': {
          // IMPORTANT: only clear the namespace, not whole localStorage
          const prefix = namespace ? `${namespace}:` : '';
          if (!prefix) throw new Error('Clear requires a namespace');
          for (let i = localStorage.length - 1; i >= 0; i--) {
            const k = localStorage.key(i);
            if (k && k.startsWith(prefix)) localStorage.removeItem(k);
          }
          reply(event, {
            channel: CHANNEL,
            kind: 'response',
            id,
            success: true,
            value: true,
          });
          return;
        }
        case 'keys': {
          const prefix = namespace ? `${namespace}:` : '';
          const keys: string[] = [];
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k) continue;
            if (!prefix || k.startsWith(prefix)) {
              keys.push(prefix ? k.substring(prefix.length) : k);
            }
          }
          reply(event, {
            channel: CHANNEL,
            kind: 'response',
            id,
            success: true,
            value: keys,
          });
          return;
        }
        default:
          throw new Error(
            `Unknown action: ${(action as string) || 'n/a'}`
          );
      }
    } catch (err) {
      reply(event, {
        channel: CHANNEL,
        kind: 'response',
        id,
        success: false,
        error: (err as Error).message || String(err),
      });
    }
  }
});
