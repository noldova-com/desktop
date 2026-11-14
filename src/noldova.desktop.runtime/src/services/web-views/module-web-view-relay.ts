/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type JsonObject, JsonReader, type JsonValue } from "@noldova/context.json";
import { WebViewAction, WebViewEventKind } from "@noldova/desktop.protocol";

import type { IWebViewRelay } from "../../interfaces/i-web-view-relay.js";
import { WebViewProtocolEvent } from "../../models/web-view-protocol-event.js";
import { Resources } from "../../resources.js";
import type { WebViewCenter } from "./web-view-center.js";

export class ModuleWebViewRelay implements IWebViewRelay {
  private readonly moduleId: string;
  private readonly center: WebViewCenter;

  public constructor(moduleId: string, center: WebViewCenter) {
    this.moduleId = moduleId;
    this.center = center;
  }

  public sendAsync(id: string, method: string, params: JsonObject, timeout: number): Promise<JsonValue> {
    return this.center.commandAsync(this.moduleId, WebViewAction.Send, id, {
      [Resources.webViewMethodField]: method, [Resources.webViewParamsField]: params, [Resources.webViewTimeoutField]: timeout
    });
  }

  public onProtocolEvent(id: string, listener: (event: WebViewProtocolEvent) => void): () => void {
    return this.center.listen(this.moduleId, t => {
      if (t.kind !== WebViewEventKind.Protocol || t.view !== id)
        return;
      const details = JsonReader.fromValue(t.details);
      listener(new WebViewProtocolEvent(
        t.view, details.readString(Resources.webViewMethodField), details.readObject(Resources.webViewParamsField).toJson(), t.details[Resources.webViewIsCutField] === true));
    });
  }
}
