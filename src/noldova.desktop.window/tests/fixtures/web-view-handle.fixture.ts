/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Type } from "@angular/core";
import { type WebViewEvent, WebViewNavigation, WebViewNavigationKind, type WebViewPane } from "@noldova/desktop.protocol";

import type { IWebViewFindOptions } from "../../src/app/interfaces/i-web-view-find-options";
import type { IWebViewFound } from "../../src/app/interfaces/i-web-view-found";
import type { IWebViewHandle } from "../../src/app/interfaces/i-web-view-handle";
import type { IWebViewLayer } from "../../src/app/interfaces/i-web-view-layer";

export class WebViewHandleFixture implements IWebViewHandle {
  public readonly id: string;
  public readonly pane: WebViewPane;
  public readonly profileKey: string;
  public readonly calls: string[] = [];
  public readonly listeners: Set<(event: WebViewEvent) => void> = new Set();
  public isClosed: boolean = false;

  public constructor(id: string, pane: WebViewPane, profileKey: string) {
    this.id = id;
    this.pane = pane;
    this.profileKey = profileKey;
  }

  public mount(host: HTMLElement): void {
    this.calls.push(`mount ${host.localName}`);
  }

  public show(): void {
    this.calls.push("show");
  }

  public hide(): void {
    this.calls.push("hide");
  }

  public async openLayerAsync<T>(load: () => Promise<Type<T>>): Promise<IWebViewLayer<T>> {
    this.calls.push("openLayer");
    await load();
    throw new Error("The fixture opens no layer.");
  }

  public navigateAsync(url: string): Promise<WebViewNavigation> {
    return this.answerAsync(`navigate ${url}`);
  }

  public goBackAsync(): Promise<WebViewNavigation> {
    return this.answerAsync("back");
  }

  public goForwardAsync(): Promise<WebViewNavigation> {
    return this.answerAsync("forward");
  }

  public reloadAsync(): Promise<WebViewNavigation> {
    return this.answerAsync("reload");
  }

  public stopAsync(): Promise<WebViewNavigation> {
    return this.answerAsync("stop");
  }

  public getZoomAsync(): Promise<number> {
    return this.zoomAsync("zoom");
  }

  public setZoomAsync(factor: number): Promise<number> {
    return this.zoomAsync(`zoom ${factor}`);
  }

  public zoomInAsync(): Promise<number> {
    return this.zoomAsync("zoom in");
  }

  public zoomOutAsync(): Promise<number> {
    return this.zoomAsync("zoom out");
  }

  public findAsync(text: string, options: IWebViewFindOptions = {}): Promise<IWebViewFound> {
    return this.foundAsync(`find ${text} ${String(options.matchCase ?? false)}`);
  }

  public findNextAsync(): Promise<IWebViewFound> {
    return this.foundAsync("find next");
  }

  public findPreviousAsync(): Promise<IWebViewFound> {
    return this.foundAsync("find previous");
  }

  public endFind(): void {
    this.calls.push("end find");
  }

  public subscribe(listener: (event: WebViewEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public close(): void {
    this.calls.push("close");
    this.isClosed = true;
  }

  private zoomAsync(call: string): Promise<number> {
    this.calls.push(call);
    return Promise.resolve(1);
  }

  private foundAsync(call: string): Promise<IWebViewFound> {
    this.calls.push(call);
    return Promise.resolve({ matches: 0, active: 0, isTimedOut: false, isEnded: false });
  }

  private answerAsync(call: string): Promise<WebViewNavigation> {
    this.calls.push(call);
    return Promise.resolve(new WebViewNavigation(WebViewNavigationKind.Started));
  }
}
