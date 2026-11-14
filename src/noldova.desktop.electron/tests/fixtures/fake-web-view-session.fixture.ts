/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IWebViewRedirect, IWebViewRequest, IWebViewSession } from "@noldova/desktop.electron";

import { FakePreventableEvent } from "./fake-preventable-event.fixture.js";
import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeWebViewSession implements IWebViewSession {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();
  private permissionHandler: ((contents: { readonly id: number } | null, permission: string, callback: (isGranted: boolean) => void) => void) | null = null;
  private displayHandler: ((webContentsId: number | null, refuse: () => void) => void) | null = null;
  private requestListener: ((request: IWebViewRequest, callback: (response: { readonly cancel: boolean }) => void) => void) | null = null;
  private headersListener: ((request: IWebViewRequest, callback: (response: { readonly cancel: boolean }) => void) => void) | null = null;
  private redirectListener: ((redirect: IWebViewRedirect) => void) | null = null;
  public checkHandler: (() => boolean) | null = null;
  public deviceHandler: (() => boolean) | null = null;
  public readonly addresses: Map<string, readonly string[]> = new Map();
  public clears: number = 0;
  public clearFailure: Error | null = null;

  public setPermissionRequestHandler(handler: (contents: { readonly id: number } | null, permission: string, callback: (isGranted: boolean) => void) => void): void {
    this.permissionHandler = handler;
  }

  public setPermissionCheckHandler(handler: () => boolean): void {
    this.checkHandler = handler;
  }

  public setDevicePermissionHandler(handler: () => boolean): void {
    this.deviceHandler = handler;
  }

  public setDisplayMediaRequestHandler(handler: (webContentsId: number | null, refuse: () => void) => void): void {
    this.displayHandler = handler;
  }

  public onBeforeRequest(listener: (request: IWebViewRequest, callback: (response: { readonly cancel: boolean }) => void) => void): void {
    this.requestListener = listener;
  }

  public onBeforeSendHeaders(listener: (request: IWebViewRequest, callback: (response: { readonly cancel: boolean }) => void) => void): void {
    this.headersListener = listener;
  }

  public onBeforeRedirect(listener: (redirect: IWebViewRedirect) => void): void {
    this.redirectListener = listener;
  }

  public on(event: string, listener: (...values: never[]) => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public resolveHostAsync(host: string): Promise<readonly string[]> {
    const addresses = this.addresses.get(host);
    return Object.isUndefined(addresses) ? Promise.reject(new Error("ERR_NAME_NOT_RESOLVED")) : Promise.resolve(addresses);
  }

  public clearStorageDataAsync(): Promise<void> {
    this.clears += 1;
    return Object.isNull(this.clearFailure) ? Promise.resolve() : Promise.reject(this.clearFailure);
  }

  public request(request: IWebViewRequest): boolean {
    let isCancelled = true;
    this.requestListener?.(request, t => {
      isCancelled = t.cancel;
    });
    return !isCancelled;
  }

  public sendHeaders(request: IWebViewRequest): boolean {
    let isCancelled = true;
    this.headersListener?.(request, t => {
      isCancelled = t.cancel;
    });
    return !isCancelled;
  }

  public redirect(redirect: IWebViewRedirect): void {
    this.redirectListener?.(redirect);
  }

  public askPermission(contentsId: number | null, permission: string): boolean {
    let isGranted = true;
    this.permissionHandler?.(Object.isNull(contentsId) ? null : { id: contentsId }, permission, t => {
      isGranted = t;
    });
    return isGranted;
  }

  public askDisplayMedia(contentsId: number | null): boolean {
    let isRefused = false;
    this.displayHandler?.(contentsId, () => {
      isRefused = true;
    });
    return isRefused;
  }

  public download(url: string, contentsId: number | null): boolean {
    const event = new FakePreventableEvent();
    this.listeners.emit("will-download", event, url, contentsId);
    return event.isPrevented;
  }
}
