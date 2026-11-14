/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { WebViewAction, type WebViewEvent, WebViewEventKind, type WebViewInfo, WebViewNavigation } from "@noldova/desktop.protocol";

import type { IRuntimeWebViews } from "../../interfaces/i-runtime-web-views.js";
import type { IWebViewRelay } from "../../interfaces/i-web-view-relay.js";
import { Resources } from "../../resources.js";
import { ModuleWebViewRelay } from "./module-web-view-relay.js";
import type { WebViewCenter } from "./web-view-center.js";

export class ModuleWebViews implements IRuntimeWebViews {
  private static readonly MOVES: readonly WebViewAction[] = [WebViewAction.Back, WebViewAction.Forward, WebViewAction.Reload, WebViewAction.Stop];

  private readonly moduleId: string;
  private readonly center: WebViewCenter;

  public readonly relay: IWebViewRelay;

  public constructor(moduleId: string, center: WebViewCenter) {
    this.moduleId = moduleId;
    this.center = center;
    this.relay = new ModuleWebViewRelay(moduleId, center);
  }

  public list(): readonly WebViewInfo[] {
    return this.center.list(this.moduleId);
  }

  public async navigateAsync(id: string, url: string): Promise<WebViewNavigation> {
    return WebViewNavigation.fromJson(await this.center.commandAsync(this.moduleId, WebViewAction.Navigate, id, url));
  }

  public async actAsync(id: string, action: WebViewAction): Promise<WebViewNavigation> {
    if (!ModuleWebViews.MOVES.includes(action))
      throw new ArgumentException(Resources.webViewMoveInvalid, Resources.webViewActionParameter);
    return WebViewNavigation.fromJson(await this.center.commandAsync(this.moduleId, action, id));
  }

  public async setAllowedOriginsAsync(id: string, origins: readonly string[]): Promise<void> {
    await this.center.commandAsync(this.moduleId, WebViewAction.SetAllowedOrigins, id, [...origins]);
  }

  public async clearProfileAsync(profileKey: string): Promise<void> {
    await this.center.commandAsync(this.moduleId, WebViewAction.ClearProfile, null, profileKey);
  }

  public onViewEvent(listener: (event: WebViewEvent) => void): () => void {
    return this.center.listen(this.moduleId, t => {
      if (t.kind !== WebViewEventKind.Protocol)
        listener(t);
    });
  }
}
