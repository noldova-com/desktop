/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IPreventableEvent } from "../interfaces/i-preventable-event.js";
import type { IWebViewAttachParams } from "../interfaces/i-web-view-attach-params.js";
import type { IWebViewAttachPreferences } from "../interfaces/i-web-view-attach-preferences.js";
import { Resources } from "../resources.js";

export class WebViewAttachGuard {
  private readonly isAllowed: (windowId: number, partition: string) => boolean;
  private readonly claim: (windowId: number, partition: string) => boolean;
  private readonly log: (text: string) => void;
  private readonly preloadPath: string;

  public constructor(isAllowed: (windowId: number, partition: string) => boolean, claim: (windowId: number, partition: string) => boolean, log: (text: string) => void, preloadPath: string) {
    this.isAllowed = isAllowed;
    this.claim = claim;
    this.log = log;
    this.preloadPath = preloadPath;
  }

  public judge(contentsId: number, isGuest: boolean, event: IPreventableEvent, preferences: IWebViewAttachPreferences, params: IWebViewAttachParams): void {
    if (isGuest)
      return event.preventDefault();
    const partition = params.partition ?? String.empty;
    if (!this.isAllowed(contentsId, partition)) {
      event.preventDefault();
      return this.log(Resources.formatWebViewAttachRefused(contentsId, partition));
    }
    params.src = this.claim(contentsId, partition) ? String.empty : Resources.blankPage;
    delete preferences.preload;
    delete preferences.preloadURL;
    preferences.preload = this.preloadPath;
    preferences.nodeIntegration = false;
    preferences.nodeIntegrationInSubFrames = true;
    preferences.nodeIntegrationInWorker = false;
    preferences.contextIsolation = true;
    preferences.sandbox = true;
    preferences.webviewTag = false;
    preferences.navigateOnDragDrop = false;
    preferences.safeDialogs = true;
    preferences.zoomMode = Resources.webViewZoomMode;
  }
}
