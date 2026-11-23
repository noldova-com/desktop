/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPreventableEvent } from "./i-preventable-event.js";
import type { IWebViewRedirect } from "./i-web-view-redirect.js";
import type { IWebViewRequest } from "./i-web-view-request.js";

export interface IWebViewSession {
  setPermissionRequestHandler(handler: (contents: { readonly id: number } | null, permission: string, callback: (isGranted: boolean) => void) => void): void;
  setPermissionCheckHandler(handler: () => boolean): void;
  setDevicePermissionHandler(handler: () => boolean): void;
  setDisplayMediaRequestHandler(handler: (webContentsId: number | null, refuse: () => void) => void): void;
  onBeforeRequest(listener: (request: IWebViewRequest, callback: (response: { readonly cancel: boolean }) => void) => void): void;
  onBeforeSendHeaders(listener: (request: IWebViewRequest, callback: (response: { readonly cancel: boolean }) => void) => void): void;
  onHeadersReceived(listener: (request: IWebViewRequest, callback: (response: { readonly cancel: boolean }) => void) => void): void;
  onBeforeRedirect(listener: (redirect: IWebViewRedirect) => void): void;
  on(event: "will-download", listener: (event: IPreventableEvent, url: string, webContentsId: number | null) => void): unknown;
  resolveHostAsync(host: string): Promise<readonly string[]>;
  resolveProxyAsync(url: string): Promise<string>;
  readIconAsync(url: string, byteLimit: number, signal: AbortSignal): Promise<Uint8Array | null>;
  clearStorageDataAsync(): Promise<void>;
}
