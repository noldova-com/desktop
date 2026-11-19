/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { setTimeout as delay } from "node:timers/promises";

import "@noldova/context.core";
import { app, session, webContents, type Session } from "electron";

import type { IWebViewContents } from "../interfaces/i-web-view-contents.js";
import type { IWebViewEngine } from "../interfaces/i-web-view-engine.js";
import type { IWebViewGuest } from "../interfaces/i-web-view-guest.js";
import type { IWebViewSession } from "../interfaces/i-web-view-session.js";
import { Resources } from "../resources.js";
import { ElectronWebViewContents } from "./electron-web-view-contents.js";
import { ElectronWebViewSession } from "./electron-web-view-session.js";
import { WebViewAttachGuard } from "./web-view-attach-guard.js";

export class ElectronWebViewEngine implements IWebViewEngine {
  private readonly partitions: WeakMap<Session, string> = new WeakMap();
  private readonly preloadPath: string;

  public constructor(preloadPath: string) {
    this.preloadPath = preloadPath;
  }

  public readSession(partition: string): IWebViewSession {
    const profile = session.fromPartition(partition, { cache: false });
    this.partitions.set(profile, partition);
    return new ElectronWebViewSession(profile);
  }

  public findGuest(contentsId: number): IWebViewGuest | null {
    const guest = webContents.fromId(contentsId);
    if (Object.isUndefined(guest) || guest.isDestroyed() || guest.getType() !== Resources.webViewContentsType)
      return null;
    return { contents: new ElectronWebViewContents(guest), hostId: guest.hostWebContents?.id ?? null, partition: this.partitions.get(guest.session) ?? null };
  }

  public watchAttach(isAllowed: (windowId: number, partition: string) => boolean, log: (text: string) => void,
    claim: (windowId: number, partition: string) => boolean = () => false, attached: (windowId: number, contents: IWebViewContents) => void = () => undefined): void {
    const guard = new WebViewAttachGuard(isAllowed, claim, log, this.preloadPath);
    app.on(Resources.webContentsCreatedEvent, (_event, contents) => {
      contents.on(Resources.willAttachWebviewEvent, (event, preferences, params) =>
        guard.judge(contents.id, contents.getType() === Resources.webViewContentsType, event, preferences, params));
      contents.on(Resources.didAttachWebviewEvent, (_event, guest) => attached(contents.id, new ElectronWebViewContents(guest)));
    });
  }

  public now(): number {
    return performance.now();
  }

  public waitAsync(milliseconds: number, signal: AbortSignal): Promise<void> {
    return delay(milliseconds, undefined, { signal });
  }
}
