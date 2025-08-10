import { InjectionToken } from '@angular/core';

export interface LocalStorageBrokerConfig {
  /** Full URL to the broker HTML. e.g. https://proxy.ngx-workshop.io/assets/ngx-local-storage-broker.html */
  iframeUrl: string;
  /** The origin of the broker page; must match iframeUrl origin exactly */
  brokerOrigin: string;
  /** Optional namespace prefix. Recommended: 'mfe-remotes' */
  namespace?: string;
  /** Request timeout (ms). Default 2000 */
  requestTimeoutMs?: number;
}

export const LOCAL_STORAGE_BROKER_CONFIG =
  new InjectionToken<LocalStorageBrokerConfig>(
    'LOCAL_STORAGE_BROKER_CONFIG'
  );

export function provideLocalStorageBroker(
  config: LocalStorageBrokerConfig
) {
  return [{ provide: LOCAL_STORAGE_BROKER_CONFIG, useValue: config }];
}
