import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, NgZone } from '@angular/core';
import {
  LOCAL_STORAGE_BROKER_CONFIG,
  LocalStorageBrokerConfig,
} from './tokens';

type AnyMsg = Record<string, unknown>;

const CHANNEL = 'ngx-ls-broker';

@Injectable({ providedIn: 'root' })
export class LocalStorageBrokerService {
  private iframe?: HTMLIFrameElement;
  private iframeWindow?: Window;
  private readyPromise: Promise<void> | null = null;

  private idSeq = 0;
  private pending = new Map<
    string,
    { resolve: (v: unknown) => void; reject: (e: unknown) => void; timeoutId: any }
  >();

  constructor(
    @Inject(LOCAL_STORAGE_BROKER_CONFIG) private cfg: LocalStorageBrokerConfig,
    @Inject(DOCUMENT) private doc: Document,
    private zone: NgZone
  ) {
    this.zone.runOutsideAngular(() => {
      window.addEventListener('message', this.onMessage);
    });
  }

  private ensureIframe(): Promise<void> {
    if (this.readyPromise) return this.readyPromise;

    this.readyPromise = new Promise<void>((resolve, reject) => {
      const iframe = this.doc.createElement('iframe');
      iframe.src = this.cfg.iframeUrl;
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.style.opacity = '0';
      iframe.setAttribute('aria-hidden', 'true');

      iframe.addEventListener('load', () => {
        // After load, ping for handshake
        this.iframe = iframe;
        this.iframeWindow = iframe.contentWindow ?? undefined;

        // Send a ping to the broker; broker answers with a 'pong'
        this.postRaw({ channel: CHANNEL, kind: 'ping' });
        // Give it a moment; the first request will also await readiness
        resolve();
      });

      this.doc.body.appendChild(iframe);

      // Failsafe: if iframe can't load at all
      setTimeout(() => {
        if (!this.iframeWindow) reject(new Error('Broker iframe did not load'));
      }, 3000);
    });

    return this.readyPromise;
  }

  private onMessage = (evt: MessageEvent) => {
    // only accept messages from the broker origin
    if (evt.origin !== this.cfg.brokerOrigin) return;

    const msg = (evt.data || {}) as AnyMsg;
    if (msg['channel'] !== CHANNEL) return;

    if (msg['kind'] === 'pong') {
      // handshake message; nothing else to do
      return;
    }

    if (msg['kind'] === 'response') {
      const id = String(msg['id'] ?? '');
      const entry = this.pending.get(id);
      if (!entry) return;
      clearTimeout(entry.timeoutId);
      this.pending.delete(id);

      if (msg['success']) {
        entry.resolve(msg['value']);
      } else {
        entry.reject(new Error(String(msg['error'] ?? 'unknown error')));
      }
    }
  };

  private postRaw(payload: unknown) {
    if (!this.iframeWindow) throw new Error('Broker not ready');
    this.iframeWindow.postMessage(payload, this.cfg.brokerOrigin);
  }

  private async request<T>(action: 'get'|'set'|'remove'|'clear'|'keys', body: Record<string, unknown> = {}): Promise<T> {
    await this.ensureIframe();

    const id = String(++this.idSeq);
    const msg = {
      channel: CHANNEL,
      kind: 'request',
      id,
      action,
      namespace: this.cfg.namespace,
      ...body,
    };

    return new Promise<T>((resolve, reject) => {
      const timeoutMs = this.cfg.requestTimeoutMs ?? 2000;
      const timeoutId = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Broker request timed out: ${action}`));
      }, timeoutMs);

      this.pending.set(id, { resolve, reject, timeoutId });
      this.postRaw(msg);
    });
  }

  // Public API
  getItem(key: string): Promise<string | null> {
    return this.request('get', { key });
  }
  setItem(key: string, value: string | null): Promise<true> {
    return this.request('set', { key, value });
  }
  removeItem(key: string): Promise<true> {
    return this.request('remove', { key });
  }
  clearNamespace(): Promise<true> {
    return this.request('clear', {});
  }
  keys(): Promise<string[]> {
    return this.request('keys', {});
  }
}

