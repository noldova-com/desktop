/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { isIP } from "node:net";
import { JsonException, JsonReader, type JsonObject } from "@noldova/context.json";
import {
  WebViewAction,
  WebViewAnswered,
  WebViewEvent,
  WebViewEventKind,
  WebViewFailure,
  WebViewFailureKind,
  WebViewNavigation,
  WebViewNavigationKind,
  type IKeyStroke,
  type WebViewDeclaration,
  type WebViewInfo
} from "@noldova/desktop.protocol";
import type { IFrameNavigation } from "../interfaces/i-frame-navigation.js";
import type { IPreventableEvent } from "../interfaces/i-preventable-event.js";
import type { IWebViewContents } from "../interfaces/i-web-view-contents.js";
import type { IWebViewInput } from "../interfaces/i-web-view-input.js";
import type { IWebViewRedirect } from "../interfaces/i-web-view-redirect.js";
import type { IWebViewRequest } from "../interfaces/i-web-view-request.js";
import type { IWebViewSession } from "../interfaces/i-web-view-session.js";
import type { IWindowNavigation } from "../interfaces/i-window-navigation.js";
import type { IWindowOpenDetails } from "../interfaces/i-window-open-details.js";
import { CaughtFailure } from "../models/caught-failure.js";
import type { WebViewHistory } from "../models/web-view-history.js";
import { Resources } from "../resources.js";
import { OpenWebViewResources } from "./open-web-view.resources.js";
import { WebViewEventCut } from "./web-view-event-cut.js";
import { WebViewKeyInput } from "./web-view-key-input.js";
import type { WebViewOriginCheck } from "./web-view-origin-check.js";

export class OpenWebView {
  private readonly session: IWebViewSession;
  private readonly check: WebViewOriginCheck;
  private readonly declaration: WebViewDeclaration;
  private readonly report: (event: WebViewEvent) => void;
  private readonly isShortcut: (stroke: IKeyStroke) => boolean;
  private readonly pressShortcut: (stroke: IKeyStroke) => void;
  private readonly platform: string;
  private readonly waitAsync: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  private readonly now: () => number;
  private readonly lost: () => void;
  private readonly input: (kind: string) => void;
  private readonly endings: Set<(kind: WebViewFailureKind) => void> = new Set();
  private readonly redirects: Set<number> = new Set();
  private readonly refusedRequests: Set<number> = new Set();
  private readonly relayKeys: IKeyStroke[] = [];
  private readonly finds: Map<number, (found: JsonObject | null) => void> = new Map();
  private readonly navigations: ((answer: JsonObject | null) => void)[] = [];
  private windowRequests: readonly number[] = [];
  private lastInput: number | undefined;
  private relayedInputs: number = 0;
  private relayedPresses: readonly symbol[] = [];
  private touchPoints: readonly unknown[] = [];
  private uncountedInputs: number = 0;
  private openPageCalls: number = 0;
  private allowed: readonly string[] = [];
  private guest: IWebViewContents | null = null;
  private pendingUrl: string | undefined;
  private committedUrl: string | undefined;
  private kept: WebViewHistory | null = null;
  private keptScroll: readonly [number, number] | null = null;
  private navigationCount: number = 0;
  private inputCount: number = 0;
  private isCrashed: boolean = false;
  private isAttached: boolean = false;
  private isFocusHeld: boolean = false;
  private isClosed: boolean = false;
  private state: string = String.empty;
  private zoomFactor: number = 1;
  private search: { readonly text: string; readonly matchCase: boolean } | undefined;
  private lastFind: number = 0;

  public readonly info: WebViewInfo;
  public readonly windowId: number;
  public readonly partition: string;

  public constructor(
    info: WebViewInfo,
    windowId: number,
    partition: string,
    session: IWebViewSession,
    check: WebViewOriginCheck,
    declaration: WebViewDeclaration,
    report: (event: WebViewEvent) => void,
    isShortcut: (stroke: IKeyStroke) => boolean,
    pressShortcut: (stroke: IKeyStroke) => void,
    platform: string,
    waitAsync: (milliseconds: number, signal: AbortSignal) => Promise<void>,
    now: () => number,
    lost: () => void,
    input: (kind: string) => void) {
    this.info = info;
    this.windowId = windowId;
    this.partition = partition;
    this.session = session;
    this.check = check;
    this.declaration = declaration;
    this.report = report;
    this.isShortcut = isShortcut;
    this.pressShortcut = pressShortcut;
    this.platform = platform;
    this.waitAsync = waitAsync;
    this.now = now;
    this.lost = lost;
    this.input = input;
    this.lastInput = undefined;
    this.pendingUrl = undefined;
    this.committedUrl = undefined;
    this.search = undefined;
  }

  public get contents(): IWebViewContents | null {
    return this.guest;
  }

  public get isRestorable(): boolean {
    return !Object.isNull(this.kept) && Object.isNull(this.guest) && !this.isClosed;
  }

  public get zoom(): number {
    return this.zoomFactor;
  }

  public async keepAsync(): Promise<void> {
    const guest = this.guest;
    if (Object.isNull(guest) || guest.isDestroyed() || guest.getURL() !== this.committedUrl)
      return;
    const kept = guest.readHistory();
    this.kept = kept;
    this.keptScroll = null;
    const scroll = await this.readScrollAsync(guest);
    if (this.kept === kept)
      this.keptScroll = scroll;
  }

  public async bindAsync(guest: IWebViewContents, isPristine: boolean = false): Promise<boolean> {
    const previous = this.guest;
    if (this.isClosed)
      return false;
    if (!Object.isNull(previous) && previous.id === guest.id)
      return true;
    if (!Object.isNull(previous)) {
      this.endFind();
      this.end(WebViewFailureKind.Unavailable);
    }
    this.guest = guest;
    this.isAttached = false;
    this.isFocusHeld = false;
    this.isCrashed = false;
    if (!Object.isNull(previous) && !previous.isDestroyed() && previous.debugger.isAttached())
      previous.debugger.detach();
    this.listen(guest);
    this.state = JSON.stringify(this.readState(guest));
    this.restoreZoom();
    const [failure] = await Promise.all([this.attachAsync(guest), isPristine ? this.startAsync(guest, true) : null]);
    if (!Object.isNull(failure)) {
      if (this.guest === guest)
        this.loseUnlessEnding(guest, failure);
      return false;
    }
    if (this.guest !== guest)
      return false;
    if (!isPristine)
      await this.startAsync(guest, false);
    return true;
  }

  public setAllowedOrigins(origins: readonly string[]): void {
    this.allowed = [...origins];
  }

  public async navigateAsync(url: string): Promise<JsonObject | null> {
    if (this.isClosed)
      return null;
    if (Object.isNull(this.guest)) {
      this.pendingUrl = url;
      return new Promise(resolve => this.navigations.push(resolve));
    }
    if (!(await this.allowsAsync(url)))
      return OpenWebView.refused(url);
    const guest = this.guest;
    if (this.isClosed || Object.isNull(guest))
      return this.navigateAsync(url);
    this.isCrashed = false;
    this.navigationCount += 1;
    void guest.loadURL(url).catch(() => undefined);
    const failure = this.isAttached ? null : await this.attachAsync(guest);
    if (!Object.isNull(failure) && this.guest === guest)
      this.loseUnlessEnding(guest, failure);
    return OpenWebView.started();
  }

  public async actAsync(action: WebViewAction): Promise<JsonObject | null> {
    const contents = this.guest;
    if (Object.isNull(contents))
      return null;
    switch (action) {
      case WebViewAction.Back:
        return this.moveAsync(contents, -1, () => contents.goBack());
      case WebViewAction.Forward:
        return this.moveAsync(contents, 1, () => contents.goForward());
      case WebViewAction.Reload: {
        const url = contents.getURL();
        if (url.length === 0 || this.isCrashed)
          return OpenWebView.noHistory();
        if (!(await this.allowsAsync(url)))
          return OpenWebView.refused(url);
        this.navigationCount += 1;
        contents.reload();
        return OpenWebView.started();
      }
      default:
        if (!contents.isLoading())
          return OpenWebView.noHistory();
        this.navigationCount += 1;
        contents.stop();
        return OpenWebView.started();
    }
  }

  public async sendAsync(call: number, method: string, params: JsonObject, timeoutMilliseconds: number): Promise<WebViewAnswered> {
    const guest = this.guest;
    if (this.isCrashed || !this.isAttached || Object.isNull(guest))
      return OpenWebView.fail(call, this.isCrashed ? WebViewFailureKind.Crashed : WebViewFailureKind.Unavailable);
    if (method === Resources.focusEmulationMethod)
      return OpenWebView.fail(call, WebViewFailureKind.NotAllowed, Resources.focusEmulationRefused);
    if (!this.declaration.allows(method, params))
      return OpenWebView.fail(call, WebViewFailureKind.NotAllowed);
    const stroke = method === Resources.dispatchKeyEventMethod ? OpenWebView.readStroke(params) : null;
    if (!Object.isNull(stroke) && this.isShortcut(stroke))
      return OpenWebView.fail(call, WebViewFailureKind.ShortcutRefused);
    const relayKey = !Object.isNull(stroke) && Resources.keyDownInputs.includes(String(params[Resources.typeField])) ? stroke : null;
    if (!Object.isNull(relayKey))
      this.relayKeys.push(relayKey);
    const abort = new AbortController();
    const isInput = method.startsWith(Resources.inputDomainPrefix);
    const isPageCall = method !== Resources.insertTextMethod && method !== Resources.dispatchKeyEventMethod;
    const presses = this.countPresses(method, params);
    const press = presses > 0 ? Symbol(method) : null;
    const isUncounted = isInput && !Resources.pressFreeInputMethods.includes(method);
    return new Promise<WebViewAnswered>(resolve => {
      const finish = (answer: WebViewAnswered): void => {
        this.endings.delete(end);
        abort.abort();
        this.forgetRelayKey(relayKey);
        resolve(answer);
      };
      const end = (kind: WebViewFailureKind): void => finish(OpenWebView.fail(call, kind));
      this.endings.add(end);
      this.waitAsync(timeoutMilliseconds, abort.signal).then(() => end(WebViewFailureKind.TimedOut), () => undefined);
      if (isInput)
        this.relayedInputs += 1;
      if (!Object.isNull(press))
        this.relayedPresses = [...this.relayedPresses, ...Array.from({ length: presses }, () => press)];
      if (isUncounted)
        this.uncountedInputs += 1;
      if (isPageCall)
        this.startPageCall();
      const sent = isPageCall ? this.holdFocusAsync(guest).then(() => OpenWebView.relayAsync(guest, method, params)) : OpenWebView.relayAsync(guest, method, params);
      if (isInput)
        void sent.then(() => this.settleInput(press, isUncounted), () => this.settleInput(press, isUncounted));
      const handled = isPageCall ? OpenWebView.afterRendererAsync(guest, sent) : sent;
      if (isPageCall)
        void handled.then(() => this.endPageCall(), () => this.endPageCall());
      handled.then(
        reply => finish(OpenWebView.answer(call, reply)),
        (error: unknown) => finish(new WebViewAnswered(call, null,
          new WebViewFailure(WebViewFailureKind.Protocol, Resources.webViewServerErrorCode, error instanceof Error ? error.message : String(error)))));
    });
  }

  public releaseFocus(): void {
    const guest = this.guest;
    if (!this.isFocusHeld || Object.isNull(guest))
      return;
    this.isFocusHeld = false;
    void guest.debugger.sendCommand(Resources.focusEmulationMethod, { [Resources.enabledParameter]: false }).catch(() => undefined);
  }

  public allowsRequest(request: IWebViewRequest): boolean {
    const isRedirect = this.redirects.delete(request.id);
    const isPage = request.resourceType === Resources.mainFrameResource;
    const isFrame = request.resourceType === Resources.subFrameResource;
    const allows = !this.refusedRequests.delete(request.id)
      && (isPage || isFrame ? this.check.allowsNavigation(request.url, this.allowed, isFrame) : this.check.allowsRequest(request.url, this.allowed));
    if (!allows && isPage)
      this.emitRefusedNavigation(request.url, isRedirect);
    return allows;
  }

  public noteRedirect(redirect: IWebViewRedirect): void {
    this.redirects.add(redirect.id);
    const ip = redirect.ip ?? String.empty;
    if (!String.isNullOrWhitespace(ip) && !this.check.allowsConnection(redirect.url, this.allowed, ip))
      this.refusedRequests.add(redirect.id);
  }

  public stepZoom(direction: number): number {
    const steps = Resources.webViewZoomSteps;
    return this.setZoom(direction > 0
      ? steps.find(t => t > this.zoomFactor) ?? Resources.webViewZoomMaximum
      : steps.findLast(t => t < this.zoomFactor) ?? Resources.webViewZoomMinimum);
  }

  public setZoom(factor: number): number {
    const target = Math.min(Math.max(factor, Resources.webViewZoomMinimum), Resources.webViewZoomMaximum);
    if (this.isCrashed || target === this.zoomFactor)
      return this.zoomFactor;
    this.zoomFactor = target;
    this.guest?.setZoomFactor(target);
    this.emit(WebViewEventKind.Zoom, { [Resources.factorField]: target });
    return target;
  }

  public findAsync(text: string, matchCase: boolean): Promise<JsonObject | null> {
    const guest = this.guest;
    if (Object.isNull(guest))
      return Promise.resolve(null);
    this.endFind();
    if (this.isCrashed)
      return Promise.resolve(OpenWebView.ended());
    if (text.length === 0)
      return Promise.resolve(OpenWebView.found(0, 0));
    const search = { text, matchCase };
    this.search = search;
    return this.requestFindAsync(guest, search, true, true);
  }

  public stepFindAsync(forward: boolean): Promise<JsonObject | null> {
    const guest = this.guest;
    if (Object.isNull(guest))
      return Promise.resolve(null);
    return Object.isUndefined(this.search) ? Promise.resolve(OpenWebView.found(0, 0)) : this.requestFindAsync(guest, this.search, false, forward);
  }

  public refuse(request: string): void {
    const guest = this.guest;
    const url = Object.isNull(guest) || guest.isDestroyed() ? String.empty : guest.getURL();
    this.emit(WebViewEventKind.RequestRefused, { [Resources.requestField]: request, [Resources.originField]: OpenWebView.originOf(url) });
  }

  public end(kind: WebViewFailureKind): void {
    for (const end of [...this.endings])
      end(kind);
  }

  public close(): void {
    if (this.isClosed)
      return;
    this.isClosed = true;
    this.end(WebViewFailureKind.ViewClosed);
    this.settleFinds(null);
    this.pendingUrl = undefined;
    for (const settle of this.navigations.splice(0))
      settle(null);
    const guest = this.guest;
    this.guest = null;
    if (!Object.isNull(guest) && !guest.isDestroyed()) {
      if (this.isAttached)
        guest.debugger.detach();
      guest.stop();
    }
    this.isAttached = false;
    this.isFocusHeld = false;
  }

  private listen(guest: IWebViewContents): void {
    guest.setWebRTCIPHandlingPolicy(Resources.webViewRtcPolicy);
    guest.setWindowOpenHandler(details => {
      if (this.isBound(guest))
        this.askForWindow(details);
      return { action: Resources.denyWindowOpen };
    });
    guest.on(Resources.inputEvent, (_event, input) => {
      if (this.isBound(guest))
        this.noteInput(input.type);
    });
    guest.on(Resources.willFrameNavigateEvent, navigation => this.judgeFrame(guest, navigation));
    guest.on(Resources.didStartNavigationEvent, navigation => this.noteStart(guest, navigation));
    guest.on(Resources.willAttachWebviewEvent, event => this.prevent(guest, event, Resources.nestedViewRequest));
    guest.on(Resources.beforeInputEvent, (event, input) => {
      if (this.isBound(guest))
        this.judgeInput(event, input);
    });
    guest.on(Resources.certificateErrorEvent, (event, _url, _error, _certificate, callback) => {
      this.prevent(guest, event, Resources.certificateRequest);
      callback(false);
    });
    guest.on(Resources.selectClientCertificateEvent, (event, _url, _list, callback) => {
      this.prevent(guest, event, Resources.certificateRequest);
      callback();
    });
    guest.on(Resources.loginEvent, (event, _details, _info, callback) => {
      this.prevent(guest, event, Resources.authenticationRequest);
      callback();
    });
    for (const name of [Resources.didStartLoadingEvent, Resources.didStopLoadingEvent, Resources.didNavigateEvent, Resources.didNavigateInPageEvent, Resources.pageTitleUpdatedEvent] as const)
      guest.on(name, () => {
        if (this.isBound(guest))
          this.reportState();
      });
    guest.on(Resources.didFailLoadEvent, (_event, code, description, url, isMainFrame) => {
      if (this.isBound(guest) && isMainFrame && code !== Resources.webViewAbortedLoadCode && url !== Resources.sourceDocument)
        this.emit(WebViewEventKind.LoadFailed, { [Resources.addressField]: url, [Resources.codeField]: code, [Resources.descriptionField]: description });
    });
    guest.on(Resources.renderProcessGoneEvent, () => {
      if (this.isBound(guest))
        this.crash();
    });
    guest.on(Resources.didNavigateEvent, () => {
      if (!this.isBound(guest))
        return;
      this.noteCommitted(guest);
      this.endFind();
      this.restoreZoom();
    });
    guest.on(Resources.didNavigateInPageEvent, () => {
      if (this.isBound(guest))
        this.noteCommitted(guest);
    });
    guest.on(Resources.foundInPageEvent, (_event, result) => {
      if (this.isBound(guest))
        this.noteFound(result);
    });
    guest.on(Resources.zoomChangedEvent, (_event, direction) => {
      if (this.isBound(guest))
        this.stepZoom(direction === Resources.zoomInDirection ? 1 : -1);
    });
    guest.on(Resources.destroyedEvent, () => this.unbind(guest));
    guest.debugger.on(Resources.messageEvent, (_event, method, params, sessionId) => {
      if (this.isBound(guest))
        this.receive(method, params, sessionId);
    });
    guest.debugger.on(Resources.detachEvent, () => {
      if (this.isBound(guest))
        this.detach(guest);
    });
  }

  private isBound(guest: IWebViewContents): boolean {
    return this.guest === guest;
  }

  private unbind(guest: IWebViewContents): void {
    if (!this.isBound(guest))
      return;
    this.guest = null;
    this.isAttached = false;
    this.isFocusHeld = false;
    this.endFind();
    this.end(WebViewFailureKind.Unavailable);
  }

  private noteCommitted(guest: IWebViewContents): void {
    this.kept = null;
    const url = guest.getURL();
    if (url.length > 0 && url !== Resources.blankPage)
      this.committedUrl = url;
  }

  private async attachAsync(guest: IWebViewContents): Promise<string | null> {
    try {
      if (!guest.debugger.isAttached())
        guest.debugger.attach(Resources.webViewProtocolVersion);
      this.isAttached = true;
      await guest.debugger.sendCommand(Resources.pageEnableMethod, {});
      await guest.debugger.sendCommand(Resources.interceptFileChooserMethod, { [Resources.enabledField]: true });
      return null;
    }
    catch (error) {
      return String(error);
    }
  }

  private endFind(): void {
    const guest = this.guest;
    if (!Object.isUndefined(this.search) && !Object.isNull(guest) && !guest.isDestroyed())
      guest.stopFindInPage(Resources.clearSelection);
    this.search = undefined;
    this.settleFinds(OpenWebView.ended());
  }

  private restoreZoom(): void {
    const guest = this.guest;
    if (!Object.isNull(guest) && guest.getZoomFactor() !== this.zoomFactor)
      guest.setZoomFactor(this.zoomFactor);
  }

  private requestFindAsync(guest: IWebViewContents, search: { readonly text: string; readonly matchCase: boolean }, isNew: boolean, forward: boolean): Promise<JsonObject | null> {
    const id = guest.findInPage(search.text, { forward, findNext: isNew, matchCase: search.matchCase });
    this.lastFind = id;
    const abort = new AbortController();
    this.waitAsync(Resources.webViewFindTimeout, abort.signal).then(() => this.settleFind(id, OpenWebView.timedOut()), () => undefined);
    return new Promise(resolve => this.finds.set(id, found => {
      abort.abort();
      resolve(found);
    }));
  }

  private settleFind(id: number, found: JsonObject): void {
    const resolve = this.finds.get(id);
    if (Object.isUndefined(resolve))
      return;
    this.finds.delete(id);
    resolve(found);
  }

  private noteFound(result: { readonly requestId: number; readonly activeMatchOrdinal: number; readonly matches: number; readonly finalUpdate: boolean }): void {
    if (!result.finalUpdate || Object.isUndefined(this.search))
      return;
    const found = OpenWebView.found(result.matches, result.activeMatchOrdinal);
    this.settleFinds(found, result.requestId);
    if (result.requestId === this.lastFind)
      this.emit(WebViewEventKind.Found, found);
  }

  private settleFinds(found: JsonObject | null, upTo: number = Number.MAX_SAFE_INTEGER): void {
    for (const [id, resolve] of [...this.finds]) {
      if (id > upTo)
        continue;
      this.finds.delete(id);
      resolve(found);
    }
  }

  private judgeZoomKey(event: IPreventableEvent, stroke: IKeyStroke): void {
    const isMac = this.platform === Resources.macPlatform;
    const step = Resources.webViewZoomKeys.get(stroke.code) ?? Resources.webViewZoomKeys.get(stroke.key);
    if (Object.isUndefined(step) || stroke.altKey || stroke.ctrlKey === isMac || stroke.metaKey !== isMac)
      return;
    event.preventDefault();
    if (step === 0)
      this.setZoom(1);
    else
      this.stepZoom(step);
  }

  private goToAsync(url: string | undefined): Promise<JsonObject | null> {
    return Object.isUndefined(url) ? Promise.resolve(null) : this.navigateAsync(url);
  }

  private async startAsync(guest: IWebViewContents, isPristine: boolean): Promise<void> {
    const pending = this.pendingUrl;
    const kept = isPristine && Object.isUndefined(pending) ? this.kept : null;
    const scroll = this.keptScroll;
    this.pendingUrl = undefined;
    this.kept = null;
    this.keptScroll = null;
    const navigations = this.navigations.splice(0);
    const answer = Object.isNull(kept) ? await this.goToAsync(pending ?? this.committedUrl) : await this.restoreAsync(guest, kept, scroll);
    for (const settle of navigations)
      settle(answer);
  }

  private async restoreAsync(guest: IWebViewContents, kept: WebViewHistory, scroll: readonly [number, number] | null): Promise<JsonObject | null> {
    const count = this.navigationCount;
    const inputs = this.inputCount;
    const url = kept.currentUrl;
    const isRestorable = !Object.isNull(url) && url === this.committedUrl && await this.allowsAsync(url) && !this.isClosed && this.guest === guest;
    if (this.navigationCount !== count)
      return null;
    if (!isRestorable)
      return this.goToAsync(this.committedUrl);
    this.isCrashed = false;
    void guest.restoreHistoryAsync(kept).then(() => this.scrollBackAsync(guest, kept, count, inputs, scroll), () => {
      if (this.navigationCount === count && this.guest === guest && !this.isClosed && guest.getURL() === String.empty)
        void this.goToAsync(this.committedUrl);
    });
    return OpenWebView.started();
  }

  private async scrollBackAsync(guest: IWebViewContents, kept: WebViewHistory, count: number, inputs: number, scroll: readonly [number, number] | null): Promise<void> {
    if (Object.isNull(scroll) || (scroll[0] === 0 && scroll[1] === 0))
      return;
    const shown = await this.readScrollAsync(guest);
    if (Object.isNull(shown) || shown[0] !== 0 || shown[1] !== 0 || this.navigationCount !== count || this.inputCount !== inputs || this.guest !== guest || guest.getURL() !== kept.currentUrl)
      return;
    await guest.executeJavaScriptInIsolatedWorld(Resources.scrollBackWorld, [{ code: Resources.formatScrollBackScript(scroll[0], scroll[1]) }]).catch(() => undefined);
  }

  private async readScrollAsync(guest: IWebViewContents): Promise<readonly [number, number] | null> {
    const abort = new AbortController();
    const read = guest.debugger.sendCommand(Resources.layoutMetricsMethod, {}).then(t => OpenWebView.readScroll(t), () => null);
    const late = this.waitAsync(Resources.webViewScrollReadTimeout, abort.signal).then(() => null, () => null);
    const scroll = await Promise.race([read, late]);
    abort.abort();
    return scroll;
  }

  private static readScroll(reply: unknown): readonly [number, number] | null {
    const viewport = OpenWebView.readObject(OpenWebView.readObject(reply)?.[Resources.layoutViewportField]);
    const [x, y] = [viewport?.[Resources.pageXField], viewport?.[Resources.pageYField]];
    return Number.isSafeInteger(x) && Number.isSafeInteger(y) ? [Number(x), Number(y)] : null;
  }

  private async moveAsync(guest: IWebViewContents, offset: number, move: () => void): Promise<JsonObject> {
    const url = guest.readHistoryEntry(offset);
    if (Object.isNull(url))
      return OpenWebView.noHistory();
    if (!(await this.allowsAsync(url)))
      return OpenWebView.refused(url);
    this.isCrashed = false;
    this.navigationCount += 1;
    move();
    return OpenWebView.started();
  }

  private async allowsAsync(url: string): Promise<boolean> {
    if (!this.check.allowsNavigation(url, this.allowed, false))
      return false;
    if (url === Resources.blankPage)
      return true;
    const host = new URL(url).hostname.replace(Resources.webViewBracketsPattern, String.empty);
    const addresses = isIP(host) !== 0 ? [host] : await this.session.resolveHostAsync(host).catch(() => []);
    return addresses.length > 0 && addresses.every(t => this.check.allowsConnection(url, this.allowed, t));
  }

  private judgeFrame(guest: IWebViewContents, navigation: IFrameNavigation): void {
    if (!this.isBound(guest))
      return navigation.preventDefault();
    if (this.check.allowsNavigation(navigation.url, this.allowed, !navigation.isMainFrame))
      return;
    navigation.preventDefault();
    if (navigation.isMainFrame)
      this.emitRefusedNavigation(navigation.url, false);
  }

  private noteStart(guest: IWebViewContents, navigation: IWindowNavigation): void {
    if (this.isBound(guest) && navigation.isMainFrame && navigation.url === Resources.sourceDocument)
      this.emitRefusedNavigation(navigation.url, false);
  }

  private askForWindow(details: IWindowOpenDetails): void {
    const now = this.now();
    this.windowRequests = this.windowRequests.filter(t => now - t < Resources.newWindowRequestMilliseconds);
    if (!this.declaration.newWindows || this.windowRequests.length >= Resources.newWindowRequestLimit || details.url.length > Resources.webViewAddressLimit)
      return this.refuse(Resources.newWindowRequest);
    this.windowRequests = [...this.windowRequests, now];
    const origin = URL.parse(details.referrer.url)?.origin ?? Resources.nullOrigin;
    this.emit(WebViewEventKind.NewWindowRequested, {
      [Resources.addressField]: details.url,
      [Resources.hadRecentInputField]: !Object.isUndefined(this.lastInput) && now - this.lastInput <= Resources.recentInputMilliseconds,
      [Resources.originField]: origin === Resources.nullOrigin ? null : origin
    });
  }

  private settleInput(press: symbol | null, isUncounted: boolean): void {
    this.relayedInputs -= 1;
    this.relayedPresses = this.relayedPresses.filter(t => t !== press);
    if (isUncounted)
      this.uncountedInputs -= 1;
  }

  private async holdFocusAsync(guest: IWebViewContents): Promise<void> {
    if (this.isFocusHeld)
      return;
    this.isFocusHeld = true;
    const isHeld = await guest.debugger.sendCommand(Resources.focusEmulationMethod, { [Resources.enabledParameter]: true }).then(() => true, () => false);
    if (!isHeld && this.guest === guest)
      this.isFocusHeld = false;
  }

  private startPageCall(): void {
    this.openPageCalls += 1;
    this.input(Resources.inputStartKind);
  }

  private endPageCall(): void {
    this.openPageCalls -= 1;
    this.input(Resources.inputEndKind);
  }

  private noteInput(type: string): void {
    if (!Resources.pointerMoveTypes.includes(type))
      this.inputCount += 1;
    const isPress = Resources.personPressTypes.includes(type);
    if (isPress && this.relayedPresses.length > 0) {
      this.relayedPresses = this.relayedPresses.slice(1);
      return;
    }
    if (this.relayedInputs === 0 && Resources.personInputTypes.includes(type))
      this.lastInput = this.now();
    if (this.openPageCalls > 0 && isPress && this.uncountedInputs === 0)
      this.input(Resources.inputPressKind);
  }

  private prevent(guest: IWebViewContents, event: IPreventableEvent, request: string): void {
    event.preventDefault();
    if (this.isBound(guest))
      this.refuse(request);
  }

  private readState(guest: IWebViewContents): JsonObject {
    return {
      [Resources.addressField]: guest.getURL(),
      [Resources.titleField]: guest.getTitle(),
      [Resources.isLoadingField]: guest.isLoading(),
      [Resources.canGoBackField]: guest.canGoBack(),
      [Resources.canGoForwardField]: guest.canGoForward()
    };
  }

  private reportState(): void {
    const guest = this.guest;
    if (this.isCrashed || Object.isNull(guest) || guest.isDestroyed())
      return;
    const details = this.readState(guest);
    const state = JSON.stringify(details);
    if (state === this.state)
      return;
    this.state = state;
    this.emit(WebViewEventKind.State, details);
  }

  private crash(): void {
    this.isCrashed = true;
    this.end(WebViewFailureKind.Crashed);
    this.endFind();
    this.emit(WebViewEventKind.Crashed);
  }

  private detach(guest: IWebViewContents): void {
    this.isAttached = false;
    this.isFocusHeld = false;
    this.end(WebViewFailureKind.Unavailable);
    if (this.isCrashed || guest.isDestroyed())
      return;
    void this.attachAsync(guest).then(t => {
      if (!Object.isNull(t) && this.isBound(guest) && !guest.isDestroyed())
        this.loseUnlessEnding(guest, t);
    });
  }

  private loseUnlessEnding(guest: IWebViewContents, failure: string): void {
    if (failure.includes(OpenWebViewResources.targetClosedError))
      this.unbind(guest);
    else
      this.lost();
  }

  private receive(method: string, params: unknown, sessionId: string): void {
    if (!String.isNullOrWhitespace(sessionId))
      return;
    if (method === Resources.fileChooserOpenedEvent)
      this.refuse(Resources.fileChooserRequest);
    if (!this.declaration.allowsEvent(method))
      return;
    const fields = OpenWebView.readObject(params);
    if (Object.isNull(fields))
      return;
    const event = WebViewEventCut.fit(this.info.module, this.info.id, method, fields, Resources.webViewEventLimit);
    if (!Object.isNull(event))
      this.report(event);
  }

  private judgeInput(event: IPreventableEvent, input: IWebViewInput): void {
    if (!Resources.keyDownInputs.includes(input.type))
      return;
    const stroke: IKeyStroke = { key: input.key, code: input.code, ctrlKey: input.control, altKey: input.alt, shiftKey: input.shift, metaKey: input.meta };
    const relayKey = this.relayKeys.find(t => OpenWebView.isSameStroke(t, stroke));
    if (!Object.isUndefined(relayKey))
      return this.forgetRelayKey(relayKey);
    const isShortcut = this.isShortcut(stroke);
    const name = isShortcut ? null : this.declaration.findKey(stroke, this.platform);
    if (!isShortcut && Object.isNull(name))
      return this.judgeZoomKey(event, stroke);
    event.preventDefault();
    if (input.isAutoRepeat)
      return;
    if (Object.isNull(name))
      this.pressShortcut(stroke);
    else
      this.emit(WebViewEventKind.Key, { [Resources.nameField]: name });
  }

  private forgetRelayKey(stroke: IKeyStroke | null): void {
    const index = Object.isNull(stroke) ? -1 : this.relayKeys.indexOf(stroke);
    if (index >= 0)
      this.relayKeys.splice(index, 1);
  }

  private emitRefusedNavigation(url: string, isRedirect: boolean): void {
    this.emit(WebViewEventKind.NavigationRefused, { [Resources.addressField]: url, [Resources.originField]: OpenWebView.originOf(url), [Resources.isRedirectField]: isRedirect });
  }

  private emit(kind: WebViewEventKind, details: JsonObject = {}): void {
    if (!this.isClosed)
      this.report(new WebViewEvent(this.info.module, this.info.id, kind, details));
  }

  private static afterRendererAsync(guest: IWebViewContents, sent: Promise<unknown>): Promise<unknown> {
    return sent.finally(() => guest.executeJavaScriptInIsolatedWorld(Resources.focusBarrierWorld, [{ code: Resources.focusBarrierScript }]).catch(() => undefined));
  }

  private static async relayAsync(guest: IWebViewContents, method: string, params: JsonObject): Promise<unknown> {
    if (method === Resources.insertTextMethod) {
      const text = params[Resources.textField];
      if (!Object.isString(text))
        throw new Error(Resources.webViewTextUnreadable);
      await guest.insertText(text);
      return {};
    }
    if (method !== Resources.dispatchKeyEventMethod)
      return guest.debugger.sendCommand(method, params);
    const events = WebViewKeyInput.read(params);
    if (events.length === 0)
      throw new Error(Resources.webViewKeyUnreadable);
    for (const event of events)
      guest.sendInputEvent(event);
    return {};
  }

  private static isSameStroke(relayed: IKeyStroke, pressed: IKeyStroke): boolean {
    return relayed.key === pressed.key && (relayed.code === String.empty || relayed.code === pressed.code)
      && relayed.ctrlKey === pressed.ctrlKey && relayed.altKey === pressed.altKey && relayed.shiftKey === pressed.shiftKey && relayed.metaKey === pressed.metaKey;
  }

  private countPresses(method: string, params: JsonObject): number {
    const points = params[Resources.touchPointsField];
    const held = this.touchPoints;
    const ids = Array.isArray(points) ? points.map(t => OpenWebView.readTouchPointId(t, method)) : [];
    if (method === Resources.dispatchTouchEventMethod)
      this.touchPoints = ids;
    if (!Resources.relayedPressTypes.has(method) || Resources.relayedPressTypes.get(method) !== params[Resources.typeField])
      return 0;
    return ids.length === 0 ? 1 : ids.filter(t => !held.includes(t)).length;
  }

  private static readStroke(params: JsonObject): IKeyStroke {
    const modifiers = Number.isSafeInteger(params[Resources.modifiersField]) ? Number(params[Resources.modifiersField]) : 0;
    return {
      key: Object.isString(params[Resources.keyField]) ? String(params[Resources.keyField]) : String.empty,
      code: Object.isString(params[Resources.codeField]) ? String(params[Resources.codeField]) : String.empty,
      altKey: (modifiers & Resources.altModifier) !== 0,
      ctrlKey: (modifiers & Resources.ctrlModifier) !== 0,
      metaKey: (modifiers & Resources.metaModifier) !== 0,
      shiftKey: (modifiers & Resources.shiftModifier) !== 0
    };
  }

  private static answer(call: number, reply: unknown): WebViewAnswered {
    const value = OpenWebView.readObject(reply);
    if (Object.isNull(value))
      return new WebViewAnswered(call, null, new WebViewFailure(WebViewFailureKind.Protocol, Resources.webViewServerErrorCode, Resources.webViewReplyNotObject));
    return Buffer.byteLength(JSON.stringify(value)) > Resources.webViewReplyLimit ? OpenWebView.fail(call, WebViewFailureKind.TooLarge) : new WebViewAnswered(call, value);
  }

  private static readTouchPointId(point: unknown, method: string): unknown {
    const id = OpenWebView.readObject(point)?.[Resources.touchPointIdField];
    return Number.isSafeInteger(id) ? id : Symbol(method);
  }

  private static readObject(value: unknown): JsonObject | null {
    try {
      return JsonReader.fromValue(value).toJson();
    }
    catch (error) {
      CaughtFailure.expect(error, JsonException);
      return null;
    }
  }

  private static fail(call: number, kind: WebViewFailureKind, message: string | null = null): WebViewAnswered {
    return new WebViewAnswered(call, null, new WebViewFailure(kind, null, message));
  }

  private static found(matches: number, active: number): JsonObject {
    const count = Math.max(matches, 0);
    return { [Resources.matchesField]: count, [Resources.activeField]: Math.min(Math.max(active, 0), count) };
  }

  private static timedOut(): JsonObject {
    return { [OpenWebViewResources.isTimedOutField]: true };
  }

  private static ended(): JsonObject {
    return { [OpenWebViewResources.isEndedField]: true };
  }

  private static originOf(url: string): string {
    return URL.parse(url)?.origin ?? Resources.nullOrigin;
  }

  private static started(): JsonObject {
    return new WebViewNavigation(WebViewNavigationKind.Started).toJson();
  }

  private static refused(url: string): JsonObject {
    return new WebViewNavigation(WebViewNavigationKind.Refused, OpenWebView.originOf(url)).toJson();
  }

  private static noHistory(): JsonObject {
    return new WebViewNavigation(WebViewNavigationKind.NoHistory).toJson();
  }
}
