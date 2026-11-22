/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import {
  KeyChord,
  WebViewAction,
  WebViewAnswered,
  WebViewEvent,
  WebViewEventKind,
  WebViewEvents,
  WebViewFailure,
  WebViewFailureKind,
  WebViewInfo,
  WebViewPane,
  type IKeyStroke,
  type WebViewCommand,
  type WebViewDeclaration
} from "@noldova/desktop.protocol";
import type { IWebViewContents } from "../interfaces/i-web-view-contents.js";
import type { IWebViewEngine } from "../interfaces/i-web-view-engine.js";
import type { IWebViewRequest } from "../interfaces/i-web-view-request.js";
import type { IWebViewSession } from "../interfaces/i-web-view-session.js";
import { WebViewRefusedPage } from "../models/web-view-refused-page.js";
import type { WindowAppearance } from "../models/window-appearance.js";
import { Resources } from "../resources.js";
import { OpenWebView } from "./open-web-view.js";
import { WebViewEventBacklog } from "./web-view-event-backlog.js";
import { WebViewOriginCheck } from "./web-view-origin-check.js";

export class WebViewHost {
  private static readonly MOVES: readonly WebViewAction[] = [WebViewAction.Back, WebViewAction.Forward, WebViewAction.Reload, WebViewAction.Stop];
  private static readonly WINDOW_EVENTS: readonly WebViewEventKind[] = [WebViewEventKind.Key, WebViewEventKind.Zoom, WebViewEventKind.Found, WebViewEventKind.Favicon,
    WebViewEventKind.Controlled];

  private readonly engine: IWebViewEngine;
  private readonly check: WebViewOriginCheck;
  private readonly readDeclarationsAsync: () => Promise<ReadonlyMap<string, WebViewDeclaration>>;
  private readonly platform: string;
  private readonly sendToWindow: (windowId: number, event: WebViewEvent) => void;
  private readonly pressShortcut: (windowId: number, stroke: IKeyStroke, press: number) => void;
  private readonly sendInput: (windowId: number, input: JsonObject) => void;
  private readonly isConnected: () => boolean;
  private readonly deliver: (events: WebViewEvents) => void;
  private readonly log: (text: string) => void;
  private readonly readAppearance: (windowId: number) => WindowAppearance | null | undefined;
  private readonly views: Map<string, OpenWebView> = new Map();
  private readonly kept: OpenWebView[] = [];
  private readonly expected: OpenWebView[] = [];
  private readonly closedContents: Set<number> = new Set();
  private readonly sessions: Map<string, IWebViewSession> = new Map();
  private readonly shortcuts: Map<number, readonly KeyChord[]> = new Map();
  private readonly shortcutPresses: Map<string, readonly [OpenWebView, (hasRun: boolean) => void]> = new Map();
  private readonly backlog: WebViewEventBacklog = new WebViewEventBacklog(Resources.webViewBacklogLimit);
  private nextId: number = 0;
  private lastPress: number = 0;
  private isFlushing: boolean = false;
  private claimed: OpenWebView | null = null;

  public constructor(
    engine: IWebViewEngine,
    check: WebViewOriginCheck,
    readDeclarationsAsync: () => Promise<ReadonlyMap<string, WebViewDeclaration>>,
    platform: string,
    sendToWindow: (windowId: number, event: WebViewEvent) => void,
    pressShortcut: (windowId: number, stroke: IKeyStroke, press: number) => void,
    sendInput: (windowId: number, input: JsonObject) => void,
    isConnected: () => boolean,
    deliver: (events: WebViewEvents) => void,
    log: (text: string) => void,
    readAppearance: (windowId: number) => WindowAppearance | null | undefined) {
    this.engine = engine;
    this.check = check;
    this.readDeclarationsAsync = readDeclarationsAsync;
    this.platform = platform;
    this.sendToWindow = sendToWindow;
    this.pressShortcut = pressShortcut;
    this.sendInput = sendInput;
    this.isConnected = isConnected;
    this.deliver = deliver;
    this.log = log;
    this.readAppearance = readAppearance;
    engine.watchAttach((windowId, partition) => this.isAttachable(windowId, partition), log,
      (windowId, partition) => this.claim(windowId, partition), (windowId, contents) => this.restore(windowId, contents));
  }

  public async openAsync(windowId: number, module: unknown, pane: unknown, profileKey: unknown, name?: unknown): Promise<JsonObject | null> {
    if (!Object.isString(module) || !Object.isString(profileKey))
      return null;
    const [owner, key]: [string, string] = [module, profileKey];
    const declaration = (await this.readDeclarationsAsync()).get(owner);
    const info = WebViewHost.read(() => new WebViewInfo(String(this.nextId + 1), owner, WebViewPane.fromJson(pane), key));
    if (Object.isUndefined(declaration) || Object.isNull(info) || this.inPane(windowId, info).length >= Resources.webViewsPerPane)
      return null;
    const partition = Resources.formatWebViewPartition(owner, key);
    const session = this.readSession(partition);
    this.nextId += 1;
    const open: OpenWebView = new OpenWebView(info, windowId, partition, session, this.check, declaration, t => this.report(open, t), t => this.isShortcut(windowId, t),
      (t, answer) => this.forwardShortcut(open, t, answer), this.platform, (t, signal) => this.engine.waitAsync(t, signal), () => this.engine.now(), () => this.lose(open),
      t => this.sendInput(windowId, { [Resources.moduleField]: info.module, [Resources.viewField]: info.id, [Resources.kindField]: t }),
      new WebViewRefusedPage(name, () => this.readAppearance(windowId)), this.log);
    this.views.set(info.id, open);
    this.report(open, WebViewHost.createEvent(open, WebViewEventKind.Opened, { [Resources.paneField]: info.pane.toJson(), [Resources.profileKeyField]: profileKey }));
    return { [Resources.viewField]: info.toJson(), [Resources.partitionField]: partition, [Resources.keysField]: declaration.keys.flatMap(t => t.keysOn(this.platform).map(u => u.text)) };
  }

  public async attachAsync(windowId: number, module: unknown, view: unknown, contentsId: unknown): Promise<JsonObject | null> {
    const open = this.find(windowId, module, view);
    if (Object.isNull(open) || !Number.isSafeInteger(contentsId))
      return null;
    const guest = this.engine.findGuest(Number(contentsId));
    if (Object.isNull(guest) || guest.hostId !== windowId || guest.partition !== open.partition || this.isBoundElsewhere(open, guest.contents.id))
      return null;
    const previous = open.contents;
    if (!Object.isNull(previous) && previous.id !== guest.contents.id)
      this.remember(previous);
    const isBound = await open.bindAsync(guest.contents);
    return isBound && this.views.get(open.info.id) === open ? { [Resources.isAttachedField]: true } : null;
  }

  public async keepAsync(windowId: number, views: unknown): Promise<boolean[]> {
    const listed: readonly unknown[] = Array.isArray(views) ? views : [];
    const opens = listed.map(t => this.findListed(windowId, t));
    for (const open of opens.filter(t => !Object.isNull(t))) {
      this.forget(open);
      this.kept.push(open);
    }
    await Promise.all(opens.map(t => t?.keepAsync()));
    return opens.map(t => !Object.isNull(t));
  }

  public expect(windowId: number, module: unknown, view: unknown): boolean {
    const open = this.find(windowId, module, view);
    if (Object.isNull(open) || !this.kept.includes(open))
      return false;
    this.forget(open);
    this.expected.push(open);
    return true;
  }

  public async navigateAsync(windowId: number, module: unknown, view: unknown, url: unknown): Promise<JsonObject | null> {
    const open = this.find(windowId, module, view);
    return Object.isNull(open) || !Object.isString(url) ? null : open.navigateAsync(url);
  }

  public async actAsync(windowId: number, module: unknown, view: unknown, action: unknown): Promise<JsonObject | null> {
    const open = this.find(windowId, module, view);
    const move = WebViewHost.MOVES.find(t => t === action);
    return Object.isNull(open) || Object.isUndefined(move) ? null : open.actAsync(move);
  }

  public zoom(windowId: number, module: unknown, view: unknown, change: unknown): number | null {
    const open = this.find(windowId, module, view);
    if (Object.isNull(open))
      return null;
    if (Object.isNull(change))
      return open.zoom;
    if (change === Resources.zoomInDirection || change === Resources.zoomOutDirection)
      return open.stepZoom(change === Resources.zoomInDirection ? 1 : -1);
    return Number.isFinite(change) ? open.setZoom(Number(change)) : null;
  }

  public async findAsync(windowId: number, module: unknown, view: unknown, request: unknown): Promise<JsonObject | null> {
    const open = this.find(windowId, module, view);
    if (Object.isNull(open))
      return null;
    if (request === Resources.webViewFindNext || request === Resources.webViewFindPrevious)
      return open.stepFindAsync(request === Resources.webViewFindNext);
    const find = WebViewHost.read(() => {
      const reader = JsonReader.fromValue(request);
      return { text: reader.readString(Resources.textField), matchCase: reader.readBoolean(Resources.matchCaseField) };
    });
    return Object.isNull(find) ? null : open.findAsync(find.text, find.matchCase);
  }

  public close(windowId: number, module: unknown, view: unknown): boolean {
    const open = this.find(windowId, module, view);
    if (Object.isNull(open))
      return false;
    this.end(open);
    return true;
  }

  public releaseFocus(windowId: number, module: unknown, view: unknown): boolean {
    const open = this.find(windowId, module, view);
    open?.releaseFocus();
    return !Object.isNull(open);
  }

  public setShortcuts(windowId: number, keys: unknown): boolean {
    const names = WebViewHost.readStrings(keys);
    const chords = Object.isNull(names) ? [] : names.map(t => KeyChord.find(t)).filter((t): t is KeyChord => !Object.isNull(t));
    if (Object.isNull(names) || chords.length !== names.length)
      return false;
    this.shortcuts.set(windowId, chords);
    return true;
  }

  public answerShortcut(windowId: number, press: unknown, hasRun: unknown): boolean {
    const key = Resources.formatShortcutPress(windowId, Number(press));
    const forwarded = Number.isSafeInteger(press) ? this.shortcutPresses.get(key) : undefined;
    if (Object.isUndefined(forwarded) || !Object.isBoolean(hasRun))
      return false;
    this.shortcutPresses.delete(key);
    forwarded[1](hasRun);
    return true;
  }

  public closeWindow(windowId: number): void {
    for (const open of [...this.views.values()].filter(t => t.windowId === windowId))
      this.end(open);
    this.shortcuts.delete(windowId);
  }

  public async commandAsync(command: WebViewCommand): Promise<WebViewAnswered> {
    if (command.action === WebViewAction.List)
      return new WebViewAnswered(command.call, [...this.views.values()].filter(t => t.info.module === command.module).map(t => t.info.toJson()));
    if (command.action === WebViewAction.ClearProfile)
      return this.clearProfileAsync(command);
    const open = this.views.get(String(command.view));
    if (Object.isUndefined(open))
      return WebViewHost.fail(command.call, WebViewFailureKind.ViewClosed);
    if (open.info.module !== command.module)
      return WebViewHost.fail(command.call, WebViewFailureKind.NotOwned);
    switch (command.action) {
      case WebViewAction.Navigate: {
        const navigation = await open.navigateAsync(String(command.value));
        return Object.isNull(navigation) ? WebViewHost.fail(command.call, WebViewFailureKind.ViewClosed) : new WebViewAnswered(command.call, navigation);
      }
      case WebViewAction.SetAllowedOrigins: {
        const origins = WebViewHost.readStrings(command.value);
        if (Object.isNull(origins) || !origins.every(t => WebViewOriginCheck.isEntry(t)))
          return WebViewHost.fail(command.call, WebViewFailureKind.NotAllowed);
        open.setAllowedOrigins(origins);
        return new WebViewAnswered(command.call);
      }
      case WebViewAction.SetControlled:
        open.setControlled(command.value === true);
        return new WebViewAnswered(command.call);
      case WebViewAction.Send: {
        const send = JsonReader.fromValue(command.value);
        return open.sendAsync(command.call, send.readString(Resources.methodField), send.readObject(Resources.paramsField).toJson(), send.readInteger(Resources.timeoutField));
      }
      default: {
        const answer = await open.actAsync(command.action);
        return Object.isNull(answer) ? WebViewHost.fail(command.call, WebViewFailureKind.Unavailable) : new WebViewAnswered(command.call, answer);
      }
    }
  }

  public flush(): void {
    if (!this.isConnected())
      return;
    const events = this.backlog.take();
    for (let start = 0; start < events.length; start += Resources.webViewBatchLimit)
      this.deliver(new WebViewEvents(events.slice(start, start + Resources.webViewBatchLimit)));
  }

  private async clearProfileAsync(command: WebViewCommand): Promise<WebViewAnswered> {
    const profileKey = String(command.value);
    const partition = Resources.formatWebViewPartition(command.module, profileKey);
    const views = [...this.views.values()].filter(t => t.info.module === command.module && t.info.profileKey === profileKey);
    for (const open of views)
      open.clearProfile();
    try {
      await this.readSession(partition).clearStorageDataAsync();
    }
    catch {
      return WebViewHost.fail(command.call, WebViewFailureKind.Unavailable);
    }
    for (const open of views)
      this.report(open, WebViewHost.createEvent(open, WebViewEventKind.ProfileCleared, { [Resources.profileKeyField]: profileKey }));
    return new WebViewAnswered(command.call);
  }

  private readSession(partition: string): IWebViewSession {
    const known = this.sessions.get(partition);
    if (!Object.isUndefined(known))
      return known;
    const session = this.engine.readSession(partition);
    session.setPermissionRequestHandler((contents, _permission, callback) => {
      callback(false);
      this.findByContents(contents?.id)?.refuse(Resources.permissionRequest);
    });
    session.setPermissionCheckHandler(() => false);
    session.setDevicePermissionHandler(() => false);
    session.setDisplayMediaRequestHandler((contentsId, refuse) => {
      refuse();
      this.findByContents(contentsId)?.refuse(Resources.permissionRequest);
    });
    session.onBeforeRequest((request, callback) => {
      const open = this.findByContents(request.webContentsId);
      if (Object.isNull(open) && Object.isNumber(request.webContentsId) && !this.closedContents.has(request.webContentsId) && request.resourceType === Resources.mainFrameResource)
        this.log(Resources.formatWebViewPageWithoutView(request.webContentsId, request.url));
      callback({ cancel: !(open?.allowsRequest(request) ?? this.allowsIconRequest(partition, request)) });
    });
    session.onBeforeSendHeaders((request, callback) => callback({ cancel: request.requestHeaders?.[Resources.serviceWorkerHeader] === Resources.serviceWorkerScript }));
    session.onBeforeRedirect(redirect => this.findByContents(redirect.webContentsId)?.noteRedirect(redirect));
    session.on(Resources.willDownloadEvent, (event, _url, contentsId) => {
      event.preventDefault();
      this.findByContents(contentsId)?.refuse(Resources.downloadRequest);
    });
    this.sessions.set(partition, session);
    return session;
  }

  private findListed(windowId: number, listed: unknown): OpenWebView | null {
    const pair: readonly unknown[] = Array.isArray(listed) ? listed : [];
    return this.find(windowId, pair[0], pair[1]);
  }

  private find(windowId: number, module: unknown, view: unknown): OpenWebView | null {
    const open = Object.isString(view) ? this.views.get(view) : undefined;
    return !Object.isUndefined(open) && open.windowId === windowId && open.info.module === module ? open : null;
  }

  private allowsIconRequest(partition: string, request: IWebViewRequest): boolean {
    return Object.isUndefined(request.webContentsId) && [...this.views.values()].some(t => t.partition === partition && t.allowsIconRequest(request.url));
  }

  private findByContents(contentsId: number | null | undefined): OpenWebView | null {
    if (Object.isNullOrUndefined(contentsId))
      return null;
    return [...this.views.values()].find(t => t.contents?.id === contentsId) ?? null;
  }

  private isBoundElsewhere(open: OpenWebView, contentsId: number): boolean {
    return [...this.views.values()].some(t => t !== open && t.contents?.id === contentsId);
  }

  private isAttachable(windowId: number, partition: string): boolean {
    return [...this.views.values()].some(t => t.windowId === windowId && t.partition === partition);
  }

  private claim(windowId: number, partition: string): boolean {
    const claimed = this.expected.find(t => t.windowId === windowId && t.partition === partition && t.isRestorable) ?? null;
    if (!Object.isNull(claimed))
      this.forget(claimed);
    this.claimed = claimed;
    return !Object.isNull(claimed);
  }

  private restore(windowId: number, contents: IWebViewContents): void {
    const open = this.claimed;
    this.claimed = null;
    if (Object.isNull(open) || open.windowId !== windowId)
      return;
    const previous = open.contents;
    if (!Object.isNull(previous))
      this.remember(previous);
    void open.bindAsync(contents, true);
  }

  private forget(open: OpenWebView): void {
    for (const list of [this.kept, this.expected]) {
      const index = list.indexOf(open);
      if (index >= 0)
        list.splice(index, 1);
    }
  }

  private inPane(windowId: number, info: WebViewInfo): readonly OpenWebView[] {
    return [...this.views.values()].filter(t => t.windowId === windowId && t.info.module === info.module && t.info.pane.equals(info.pane));
  }

  private forwardShortcut(open: OpenWebView, stroke: IKeyStroke, answer: (hasRun: boolean) => void): void {
    this.lastPress += 1;
    this.shortcutPresses.set(Resources.formatShortcutPress(open.windowId, this.lastPress), [open, answer]);
    this.pressShortcut(open.windowId, stroke, this.lastPress);
  }

  private isShortcut(windowId: number, stroke: IKeyStroke): boolean {
    return (this.shortcuts.get(windowId) ?? []).some(t => t.matches(stroke, this.platform));
  }

  private report(open: OpenWebView, event: WebViewEvent): void {
    if (event.kind !== WebViewEventKind.Protocol)
      this.sendToWindow(open.windowId, event);
    if (WebViewHost.WINDOW_EVENTS.includes(event.kind))
      return;
    this.backlog.push(event);
    if (this.isFlushing)
      return;
    this.isFlushing = true;
    queueMicrotask(() => {
      this.isFlushing = false;
      this.flush();
    });
  }

  private remember(contents: IWebViewContents): void {
    if (contents.isDestroyed())
      return;
    const contentsId = contents.id;
    this.closedContents.add(contentsId);
    contents.on(Resources.destroyedEvent, () => this.closedContents.delete(contentsId));
  }

  private end(open: OpenWebView): void {
    this.views.delete(open.info.id);
    for (const [press, [owner]] of [...this.shortcutPresses])
      if (owner === open)
        this.shortcutPresses.delete(press);
    this.forget(open);
    const contents = open.contents;
    if (!Object.isNull(contents))
      this.remember(contents);
    open.close();
    this.report(open, WebViewHost.createEvent(open, WebViewEventKind.Closed, {}));
  }

  private lose(open: OpenWebView): void {
    this.log(Resources.webViewLost);
    this.end(open);
  }

  private static read<T>(create: () => T): T | null {
    try {
      return create();
    }
    catch {
      return null;
    }
  }

  private static readStrings(value: unknown): readonly string[] | null {
    if (!Array.isArray(value))
      return null;
    const items: readonly unknown[] = value;
    const strings = items.filter((t): t is string => Object.isString(t));
    return strings.length === items.length ? strings : null;
  }

  private static createEvent(open: OpenWebView, kind: WebViewEventKind, details: JsonObject): WebViewEvent {
    return new WebViewEvent(open.info.module, open.info.id, kind, details);
  }

  private static fail(call: number, kind: WebViewFailureKind): WebViewAnswered {
    return new WebViewAnswered(call, null, new WebViewFailure(kind));
  }
}
