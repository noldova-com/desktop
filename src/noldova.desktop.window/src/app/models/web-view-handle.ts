/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Injector, Type } from "@angular/core";
import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { WebViewAction, type WebViewEvent, type WebViewInfo, type WebViewNavigation, type WebViewPane } from "@noldova/desktop.protocol";

import type { IWebViewFindOptions } from "../interfaces/i-web-view-find-options.js";
import type { IWebViewFound } from "../interfaces/i-web-view-found.js";
import type { IWebViewGuest } from "../interfaces/i-web-view-guest.js";
import type { IWebViewHandle } from "../interfaces/i-web-view-handle.js";
import type { IWebViewLayer } from "../interfaces/i-web-view-layer.js";
import type { WebViewService } from "../services/web-view.service.js";
import type { Tab } from "./layout/tab.js";
import { Resources } from "../../resources.js";

export class WebViewHandle implements IWebViewHandle {
  private readonly host: WebViewService;
  private readonly listeners: Set<(event: WebViewEvent) => void> = new Set();
  private isClosedValue: boolean = false;

  public readonly id: string;
  public readonly moduleId: string;
  public readonly pane: WebViewPane;
  public readonly profileKey: string;
  public readonly tab: Tab;
  public readonly injector: Injector;
  public readonly frame: HTMLElement;
  public readonly guest: IWebViewGuest;
  public layer: IWebViewLayer<unknown> | null = null;
  public isWanted: boolean = false;
  public isShown: boolean = false;

  public constructor(info: WebViewInfo, tab: Tab, injector: Injector, host: WebViewService, frame: HTMLElement, guest: IWebViewGuest) {
    this.id = info.id;
    this.moduleId = info.module;
    this.pane = info.pane;
    this.profileKey = info.profileKey;
    this.tab = tab;
    this.injector = injector;
    this.host = host;
    this.frame = frame;
    this.guest = guest;
  }

  public get isClosed(): boolean {
    return this.isClosedValue;
  }

  public mount(host: HTMLElement): void {
    if (!this.isClosedValue)
      this.host.mount(this, host);
  }

  public show(): void {
    if (!this.isClosedValue)
      this.host.show(this);
  }

  public hide(): void {
    if (!this.isClosedValue)
      this.host.hide(this);
  }

  public openLayerAsync<T>(load: () => Promise<Type<T>>): Promise<IWebViewLayer<T>> {
    return this.host.openLayerAsync(this, load);
  }

  public navigateAsync(url: string): Promise<WebViewNavigation> {
    return this.host.navigateAsync(this, url);
  }

  public goBackAsync(): Promise<WebViewNavigation> {
    return this.host.actAsync(this, WebViewAction.Back);
  }

  public goForwardAsync(): Promise<WebViewNavigation> {
    return this.host.actAsync(this, WebViewAction.Forward);
  }

  public reloadAsync(): Promise<WebViewNavigation> {
    return this.host.actAsync(this, WebViewAction.Reload);
  }

  public stopAsync(): Promise<WebViewNavigation> {
    return this.host.actAsync(this, WebViewAction.Stop);
  }

  public getZoomAsync(): Promise<number> {
    return this.host.zoomAsync(this, null);
  }

  public async setZoomAsync(factor: number): Promise<number> {
    if (!Number.isFinite(factor) || factor <= 0)
      throw new ArgumentException(Resources.webViewZoomInvalid, Resources.factorParameterName);
    return await this.host.zoomAsync(this, factor);
  }

  public zoomInAsync(): Promise<number> {
    return this.host.zoomAsync(this, Resources.webViewZoomIn);
  }

  public zoomOutAsync(): Promise<number> {
    return this.host.zoomAsync(this, Resources.webViewZoomOut);
  }

  public findAsync(text: string, options: IWebViewFindOptions = {}): Promise<IWebViewFound> {
    return this.host.findAsync(this, { [Resources.webViewTextField]: text, [Resources.webViewMatchCaseField]: options.matchCase ?? false });
  }

  public findNextAsync(): Promise<IWebViewFound> {
    return this.host.findAsync(this, Resources.webViewFindNext);
  }

  public findPreviousAsync(): Promise<IWebViewFound> {
    return this.host.findAsync(this, Resources.webViewFindPrevious);
  }

  public endFind(): void {
    this.host.endFind(this);
  }

  public subscribe(listener: (event: WebViewEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public close(): void {
    this.host.close(this);
  }

  public receive(event: WebViewEvent): void {
    for (const listener of [...this.listeners])
      listener(event);
  }

  public end(): boolean {
    if (this.isClosedValue)
      return false;
    this.isClosedValue = true;
    this.listeners.clear();
    return true;
  }
}
