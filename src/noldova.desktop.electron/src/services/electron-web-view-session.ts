/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { type Session, webContents } from "electron";

import { ProfileNotClearedException } from "../exceptions/profile-not-cleared.exception.js";
import type { IPreventableEvent } from "../interfaces/i-preventable-event.js";
import type { IWebViewRedirect } from "../interfaces/i-web-view-redirect.js";
import type { IWebViewRequest } from "../interfaces/i-web-view-request.js";
import type { IWebViewSession } from "../interfaces/i-web-view-session.js";
import { ResponseBody } from "../models/response-body.js";

export class ElectronWebViewSession implements IWebViewSession {
  private readonly profile: Session;

  public constructor(profile: Session) {
    this.profile = profile;
  }

  public setPermissionRequestHandler(handler: (contents: { readonly id: number } | null, permission: string, callback: (isGranted: boolean) => void) => void): void {
    this.profile.setPermissionRequestHandler(handler);
  }

  public setPermissionCheckHandler(handler: () => boolean): void {
    this.profile.setPermissionCheckHandler(handler);
  }

  public setDevicePermissionHandler(handler: () => boolean): void {
    this.profile.setDevicePermissionHandler(handler);
  }

  public setDisplayMediaRequestHandler(handler: (webContentsId: number | null, refuse: () => void) => void): void {
    this.profile.setDisplayMediaRequestHandler((request, callback) =>
      handler(Object.isNull(request.frame) ? null : webContents.fromFrame(request.frame)?.id ?? null, () => callback({})));
  }

  public onBeforeRequest(listener: (request: IWebViewRequest, callback: (response: { readonly cancel: boolean }) => void) => void): void {
    this.profile.webRequest.onBeforeRequest((details, callback) => listener(details, callback));
  }

  public onBeforeSendHeaders(listener: (request: IWebViewRequest, callback: (response: { readonly cancel: boolean }) => void) => void): void {
    this.profile.webRequest.onBeforeSendHeaders((details, callback) => listener(details, callback));
  }

  public onBeforeRedirect(listener: (redirect: IWebViewRedirect) => void): void {
    this.profile.webRequest.onBeforeRedirect(details => listener(details));
  }

  public on(event: "will-download", listener: (event: IPreventableEvent, url: string, webContentsId: number | null) => void): unknown {
    return this.profile.on(event, (download, item, contents) => listener(download, item.getURL(), contents.id));
  }

  public async resolveHostAsync(host: string): Promise<readonly string[]> {
    return (await this.profile.resolveHost(host)).endpoints.map(t => t.address);
  }

  public async readIconAsync(url: string, byteLimit: number, signal: AbortSignal): Promise<Uint8Array | null> {
    const response = await this.profile.fetch(url, { redirect: "error", signal });
    if (!response.ok || Object.isNull(response.body)) {
      await ResponseBody.letGoAsync(response);
      return null;
    }
    const reader = response.body.getReader();
    const parts: Uint8Array[] = [];
    let length = 0;
    for (let part = await reader.read(); !part.done; part = await reader.read()) {
      length += part.value.length;
      if (length > byteLimit) {
        await reader.cancel();
        return null;
      }
      parts.push(part.value);
    }
    return Buffer.concat(parts);
  }

  public async clearStorageDataAsync(): Promise<void> {
    try {
      await this.profile.clearStorageData();
      await this.profile.clearCache();
    }
    catch (error) {
      throw new ProfileNotClearedException(new ExceptionOptions(error));
    }
  }
}
