/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { ApplicationRef, DestroyRef, ErrorHandler, Injectable, Injector, type Type, effect, inject, untracked } from "@angular/core";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
import { type WebViewAction, type WebViewEvent, WebViewEventKind, type WebViewNavigation, type WebViewPane } from "@noldova/desktop.protocol";

import { WebViewInputKind } from "../enums/web-view-input-kind.js";
import { WebViewClosedException } from "../exceptions/web-view-closed.exception.js";
import { WebViewNotOpenedException } from "../exceptions/web-view-not-opened.exception.js";
import type { IWebViewFound } from "../interfaces/i-web-view-found.js";
import type { IWebViewGuest } from "../interfaces/i-web-view-guest.js";
import type { IWebViewInput } from "../interfaces/i-web-view-input.js";
import type { IWebViewLayer } from "../interfaces/i-web-view-layer.js";
import type { Layout } from "../models/layout/layout.js";
import type { Tab } from "../models/layout/tab.js";
import { WebViewHandle } from "../models/web-view-handle.js";
import { WebViewLayer } from "../models/web-view-layer.js";
import { CommandService } from "./command.service.js";
import { LayoutService } from "./layout.service.js";
import { LiveViewService } from "./live-view.service.js";
import { PreloadBridgeService } from "./preload-bridge.service.js";
import { TabDragService } from "./tab-drag.service.js";
import { ToolbarDragService } from "./toolbar-drag.service.js";
import { Resources } from "../../resources.js";

@Injectable({ providedIn: "root" })
export class WebViewService {
  private readonly bridge: PreloadBridgeService = inject(PreloadBridgeService);
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly liveViews: LiveViewService = inject(LiveViewService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly document: Document = inject(DOCUMENT);
  private readonly application: ApplicationRef = inject(ApplicationRef);
  private readonly handles: Map<string, WebViewHandle> = new Map();
  private shownTabs: ReadonlySet<string> = new Set();
  private isDragging: boolean = false;

  public constructor() {
    const commands = inject(CommandService);
    const tabDrag = inject(TabDragService);
    const toolbarDrag = inject(ToolbarDragService);
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(this.bridge.onWebViewEvent(t => this.receive(t)));
    destroyRef.onDestroy(this.bridge.onWebViewShortcut(t => commands.dispatch(t)));
    destroyRef.onDestroy(this.bridge.onWebViewInput(t => this.receiveInput(t)));
    effect(() => {
      const keys = commands.shortcuts().viewKeys;
      untracked(() => this.bridge.setWebViewShortcuts(keys));
    });
    effect(() => {
      const layout = this.layout.layout();
      const shown = this.liveViews.shownTabs();
      untracked(() => this.follow(layout, shown));
    });
    effect(() => {
      const isDragging = !Object.isNull(tabDrag.dragging()) || !Object.isNull(toolbarDrag.dragging());
      untracked(() => this.passThrough(isDragging));
    });
    destroyRef.onDestroy(() => {
      for (const handle of [...this.handles.values()])
        this.close(handle);
    });
  }

  public async openAsync(moduleId: string, pane: WebViewPane, tab: Tab, profileKey: string, injector: Injector): Promise<WebViewHandle> {
    if (!this.layout.layout().isOpen(tab))
      throw new WebViewNotOpenedException();
    const opened = await this.bridge.openWebViewAsync(moduleId, pane, profileKey);
    if (Object.isNull(opened))
      throw new WebViewNotOpenedException();
    const handle = new WebViewHandle(opened.view, tab, injector, this, this.createFrame(), this.createGuest(opened.partition));
    handle.frame.append(handle.guest);
    handle.guest.addEventListener(Resources.webViewAttachEvent, () => this.attach(handle));
    handle.guest.addEventListener(Resources.focusInEvent, () => this.noteFocus(handle));
    this.handles.set(handle.id, handle);
    this.applyVisibility(handle);
    this.applyPointerEvents(handle);
    if (!this.layout.layout().isOpen(tab)) {
      this.close(handle);
      throw new WebViewNotOpenedException();
    }
    return handle;
  }

  public mount(handle: WebViewHandle, host: HTMLElement): void {
    if (handle.frame.parentElement !== host)
      host.append(handle.frame);
  }

  public show(handle: WebViewHandle): void {
    for (const other of [...this.handles.values()].filter(t => t !== handle && t.moduleId === handle.moduleId && t.pane.equals(handle.pane))) {
      other.isWanted = false;
      this.apply(other);
    }
    handle.isWanted = true;
    this.apply(handle);
  }

  public hide(handle: WebViewHandle): void {
    handle.isWanted = false;
    this.apply(handle);
  }

  public async openLayerAsync<T>(handle: WebViewHandle, load: () => Promise<Type<T>>): Promise<IWebViewLayer<T>> {
    const component = await load();
    handle.layer?.close();
    if (handle.isClosed)
      throw new WebViewClosedException();
    const layer: WebViewLayer<T> = new WebViewLayer(handle.frame, component, handle.injector, this.application, () => {
      handle.layer = null;
    });
    handle.layer = layer;
    return layer;
  }

  public async navigateAsync(handle: WebViewHandle, url: string): Promise<WebViewNavigation> {
    return WebViewService.require(handle.isClosed ? null : await this.bridge.navigateWebViewAsync(handle.moduleId, handle.id, url));
  }

  public async actAsync(handle: WebViewHandle, action: WebViewAction): Promise<WebViewNavigation> {
    return WebViewService.require(handle.isClosed ? null : await this.bridge.actOnWebViewAsync(handle.moduleId, handle.id, action));
  }

  public async zoomAsync(handle: WebViewHandle, change: string | number | null): Promise<number> {
    return WebViewService.require(handle.isClosed ? null : await this.bridge.zoomWebViewAsync(handle.moduleId, handle.id, change));
  }

  public async findAsync(handle: WebViewHandle, request: string | JsonObject): Promise<IWebViewFound> {
    return WebViewService.require(handle.isClosed ? null : await this.bridge.findInWebViewAsync(handle.moduleId, handle.id, request));
  }

  public endFind(handle: WebViewHandle): void {
    if (handle.isClosed)
      return;
    const request = { [Resources.webViewTextField]: String.empty, [Resources.webViewMatchCaseField]: false };
    void this.bridge.findInWebViewAsync(handle.moduleId, handle.id, request).catch((error: unknown) => this.errors.handleError(error));
  }

  public close(handle: WebViewHandle): void {
    if (!handle.end())
      return;
    this.bridge.closeWebView(handle.moduleId, handle.id);
    this.remove(handle);
  }

  private createFrame(): HTMLElement {
    const frame = this.document.createElement(Resources.divElement);
    frame.className = Resources.webViewFrameClass;
    WebViewService.style(frame, Resources.webViewFrameStyle);
    return frame;
  }

  private createGuest(partition: string): IWebViewGuest {
    const guest = this.document.createElement(Resources.webViewElement);
    guest.className = Resources.webViewGuestClass;
    WebViewService.style(guest, Resources.webViewGuestStyle);
    guest.setAttribute(Resources.webViewPartitionAttribute, partition);
    guest.setAttribute(Resources.webViewSourceAttribute, Resources.webViewStartAddress);
    guest.setAttribute(Resources.webViewPopupsAttribute, String.empty);
    return guest;
  }

  private attach(handle: WebViewHandle): void {
    if (handle.isClosed)
      return;
    void this.bridge.attachWebViewAsync(handle.moduleId, handle.id, handle.guest.getWebContentsId()).then(isAttached => {
      if (!isAttached)
        this.close(handle);
    }).catch((error: unknown) => this.errors.handleError(error));
  }

  private receive(event: WebViewEvent): void {
    const handle = this.handles.get(event.view);
    if (Object.isUndefined(handle) || handle.moduleId !== event.module)
      return;
    try {
      handle.receive(event);
    }
    catch (error) {
      this.errors.handleError(error);
    }
    if (event.kind === WebViewEventKind.Closed)
      this.forget(handle);
  }

  private receiveInput(input: IWebViewInput): void {
    const handle = this.handles.get(input.view);
    if (Object.isUndefined(handle) || handle.moduleId !== input.module)
      return;
    if (input.kind === WebViewInputKind.Start) {
      if (handle.agentInputs === 0)
        handle.keptFocus = this.readPersonFocus(handle);
      handle.agentInputs += 1;
      handle.isFocusHeld = true;
      return;
    }
    if (handle.agentInputs === 0)
      return;
    if (input.kind === WebViewInputKind.Press) {
      handle.keptFocus = null;
      return;
    }
    handle.agentInputs -= 1;
    if (handle.agentInputs > 0)
      return;
    if (Object.isNull(handle.keptFocus))
      this.releaseFocus(handle);
    else if (this.document.activeElement === handle.guest)
      this.giveFocusBack(handle);
    handle.keptFocus = null;
  }

  private readPersonFocus(handle: WebViewHandle): HTMLElement | null {
    const active = this.document.activeElement;
    if (active === handle.guest)
      return null;
    return active instanceof HTMLElement ? active : this.document.body;
  }

  private noteFocus(handle: WebViewHandle): void {
    if (handle.agentInputs === 0)
      this.releaseFocus(handle);
    else
      this.giveFocusBack(handle);
  }

  private giveFocusBack(handle: WebViewHandle): void {
    const kept = handle.keptFocus;
    if (Object.isNull(kept))
      return;
    if (kept !== this.document.body && kept.isConnected)
      kept.focus({ preventScroll: true });
    else
      handle.guest.blur();
  }

  private releaseFocus(handle: WebViewHandle): void {
    if (!handle.isFocusHeld)
      return;
    handle.isFocusHeld = false;
    this.bridge.releaseWebViewFocus(handle.moduleId, handle.id);
  }

  private follow(layout: Layout, shownTabs: ReadonlySet<string>): void {
    this.shownTabs = shownTabs;
    for (const handle of [...this.handles.values()]) {
      if (layout.isOpen(handle.tab))
        this.apply(handle);
      else
        this.close(handle);
    }
  }

  private apply(handle: WebViewHandle): void {
    const isShown = handle.isWanted && this.shownTabs.has(handle.tab.key);
    if (isShown === handle.isShown)
      return;
    handle.isShown = isShown;
    this.applyVisibility(handle);
  }

  private applyVisibility(handle: WebViewHandle): void {
    if (handle.isShown)
      handle.frame.style.removeProperty(Resources.visibilityProperty);
    else
      handle.frame.style.setProperty(Resources.visibilityProperty, Resources.hiddenVisibility);
  }

  private passThrough(isDragging: boolean): void {
    this.isDragging = isDragging;
    for (const handle of [...this.handles.values()])
      this.applyPointerEvents(handle);
  }

  private applyPointerEvents(handle: WebViewHandle): void {
    if (this.isDragging)
      handle.guest.style.setProperty(Resources.pointerEventsProperty, Resources.noPointerEvents);
    else
      handle.guest.style.removeProperty(Resources.pointerEventsProperty);
  }

  private forget(handle: WebViewHandle): void {
    if (handle.end())
      this.remove(handle);
  }

  private remove(handle: WebViewHandle): void {
    this.handles.delete(handle.id);
    handle.layer?.close();
    handle.frame.remove();
  }

  private static style(element: HTMLElement, properties: Readonly<Record<string, string>>): void {
    for (const [name, value] of Object.entries(properties))
      element.style.setProperty(name, value);
  }

  private static require<T>(answer: T | null): T {
    if (Object.isNull(answer))
      throw new WebViewClosedException();
    return answer;
  }
}
