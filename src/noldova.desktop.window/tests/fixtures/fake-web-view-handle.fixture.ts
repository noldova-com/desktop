/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Type } from "@angular/core";

import type { WebViewEvent, WebViewPane } from "@noldova/desktop.protocol";
import { Fake } from "@noldova/desktop.protocol/testing";

import type { IWebViewHandle } from "../../src/app/interfaces/i-web-view-handle";
import type { IWebViewLayer } from "../../src/app/interfaces/i-web-view-layer";

export class FakeWebViewHandle extends Fake<IWebViewHandle> implements IWebViewHandle {
  private readonly listeners: Set<(event: WebViewEvent) => void> = new Set<(event: WebViewEvent) => void>();

  public readonly mount: IWebViewHandle["mount"] = (...args) => this.tell("mount", args, this.answers.mount);
  public readonly show: IWebViewHandle["show"] = (...args) => this.tell("show", args, this.answers.show);
  public readonly hide: IWebViewHandle["hide"] = (...args) => this.tell("hide", args, this.answers.hide);
  public readonly navigateAsync: IWebViewHandle["navigateAsync"] = (...args) => this.respondAsync("navigateAsync", args, this.answers.navigateAsync);
  public readonly goBackAsync: IWebViewHandle["goBackAsync"] = (...args) => this.respondAsync("goBackAsync", args, this.answers.goBackAsync);
  public readonly goForwardAsync: IWebViewHandle["goForwardAsync"] = (...args) => this.respondAsync("goForwardAsync", args, this.answers.goForwardAsync);
  public readonly reloadAsync: IWebViewHandle["reloadAsync"] = (...args) => this.respondAsync("reloadAsync", args, this.answers.reloadAsync);
  public readonly stopAsync: IWebViewHandle["stopAsync"] = (...args) => this.respondAsync("stopAsync", args, this.answers.stopAsync);
  public readonly getZoomAsync: IWebViewHandle["getZoomAsync"] = (...args) => this.respondAsync("getZoomAsync", args, this.answers.getZoomAsync);
  public readonly setZoomAsync: IWebViewHandle["setZoomAsync"] = (...args) => this.respondAsync("setZoomAsync", args, this.answers.setZoomAsync);
  public readonly zoomInAsync: IWebViewHandle["zoomInAsync"] = (...args) => this.respondAsync("zoomInAsync", args, this.answers.zoomInAsync);
  public readonly zoomOutAsync: IWebViewHandle["zoomOutAsync"] = (...args) => this.respondAsync("zoomOutAsync", args, this.answers.zoomOutAsync);
  public readonly findAsync: IWebViewHandle["findAsync"] = (...args) => this.respondAsync("findAsync", args, this.answers.findAsync);
  public readonly findNextAsync: IWebViewHandle["findNextAsync"] = (...args) => this.respondAsync("findNextAsync", args, this.answers.findNextAsync);
  public readonly findPreviousAsync: IWebViewHandle["findPreviousAsync"] = (...args) => this.respondAsync("findPreviousAsync", args, this.answers.findPreviousAsync);
  public readonly endFind: IWebViewHandle["endFind"] = (...args) => this.tell("endFind", args, this.answers.endFind);
  public readonly subscribe: IWebViewHandle["subscribe"] = listener => this.listen("subscribe", [listener], this.listeners, listener);
  public readonly close: IWebViewHandle["close"] = (...args) => this.tell("close", args, this.answers.close);

  public get id(): string {
    return this.propertyOf("id", this.answers.id);
  }

  public get pane(): WebViewPane {
    return this.propertyOf("pane", this.answers.pane);
  }

  public get profileKey(): string {
    return this.propertyOf("profileKey", this.answers.profileKey);
  }

  public get isClosed(): boolean {
    return this.propertyOf("isClosed", this.answers.isClosed);
  }

  public openLayerAsync<T>(load: () => Promise<Type<T>>): Promise<IWebViewLayer<T>> {
    return this.answerOfAsync("openLayerAsync", [load], this.answers.openLayerAsync, t => t<T>(load));
  }

  public raiseEvent(event: WebViewEvent): void {
    this.raise(this.listeners, t => t(event));
  }
}
