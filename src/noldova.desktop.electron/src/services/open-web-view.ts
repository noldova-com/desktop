/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { randomUUID } from "node:crypto";
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
import type { IWebViewFrame } from "../interfaces/i-web-view-frame.js";
import type { IWebViewInput } from "../interfaces/i-web-view-input.js";
import type { IWebViewInputEvent } from "../interfaces/i-web-view-input-event.js";
import type { IWebViewRedirect } from "../interfaces/i-web-view-redirect.js";
import type { IWebViewRequest } from "../interfaces/i-web-view-request.js";
import type { IWebViewSession } from "../interfaces/i-web-view-session.js";
import type { IWindowNavigation } from "../interfaces/i-window-navigation.js";
import type { IWindowOpenDetails } from "../interfaces/i-window-open-details.js";
import { CaughtFailure } from "../models/caught-failure.js";
import type { WebViewHistory } from "../models/web-view-history.js";
import type { WebViewRefusedPage } from "../models/web-view-refused-page.js";
import { Resources } from "../resources.js";
import { WebViewEventCut } from "./web-view-event-cut.js";
import { WebViewFavicon } from "./web-view-favicon.js";
import { WebViewKeyInput } from "./web-view-key-input.js";
import type { WebViewOriginCheck } from "./web-view-origin-check.js";

export class OpenWebView {
  private readonly session: IWebViewSession;
  private readonly check: WebViewOriginCheck;
  private readonly declaration: WebViewDeclaration;
  private readonly report: (event: WebViewEvent) => void;
  private readonly isShortcut: (stroke: IKeyStroke) => boolean;
  private readonly pressShortcut: (stroke: IKeyStroke, answer: (hasRun: boolean) => void) => void;
  private readonly platform: string;
  private readonly waitAsync: (milliseconds: number, signal: AbortSignal) => Promise<void>;
  private readonly now: () => number;
  private readonly lost: () => void;
  private readonly input: (kind: string) => void;
  private readonly refusedPage: WebViewRefusedPage;
  private readonly log: (text: string) => void;
  private readonly endings: Set<(kind: WebViewFailureKind) => void> = new Set();
  private readonly attachWaits: Map<(guest: IWebViewContents) => void, (kind: WebViewFailureKind) => void> = new Map();
  private readonly lookupsSettled: (() => void)[] = [];
  private readonly redirects: Set<number> = new Set();
  private readonly refusedRequests: Set<number> = new Set();
  private readonly relayKeys: IKeyStroke[] = [];
  private readonly replays: IKeyStroke[] = [];
  private readonly finds: Map<number, (found: JsonObject | null) => void> = new Map();
  private readonly navigations: ((answer: JsonObject | null) => void)[] = [];
  private readonly favicon: WebViewFavicon;
  private windowRequests: readonly number[] = [];
  private lastInput: number | undefined;
  private lastPress: number | undefined;
  private relayedInputs: number = 0;
  private relayedPresses: readonly symbol[] = [];
  private heldInputs: readonly (readonly [IWebViewContents, IWebViewInput, boolean])[] = [];
  private relayCopies: number = 0;
  private declinedKey: IKeyStroke | null = null;
  private isAnswerAwaited: boolean = false;
  private touchPoints: readonly unknown[] = [];
  private uncountedInputs: number = 0;
  private refusedPages: ReadonlyMap<number, string> = new Map();
  private admittedPages: ReadonlyMap<number, string> = new Map();
  private openPageCalls: number = 0;
  private releases: Set<() => void> = new Set();
  private allowed: readonly string[] = [];
  private guest: IWebViewContents | null = null;
  private pendingUrl: string | undefined;
  private committedUrl: string | undefined;
  private kept: WebViewHistory | null = null;
  private keptScroll: readonly [number, number] | null = null;
  private pendingScroll: { readonly guest: IWebViewContents; readonly scroll: readonly [number, number] } | null = null;
  private navigationCount: number = 0;
  private inputCount: number = 0;
  private isCrashed: boolean = false;
  private isAttached: boolean = false;
  private isReady: boolean = false;
  private lookupCount: number = 0;
  private isFocusHeld: boolean = false;
  private isClosed: boolean = false;
  private isControlled: boolean = false;
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
    pressShortcut: (stroke: IKeyStroke, answer: (hasRun: boolean) => void) => void,
    platform: string,
    waitAsync: (milliseconds: number, signal: AbortSignal) => Promise<void>,
    now: () => number,
    lost: () => void,
    input: (kind: string) => void,
    refusedPage: WebViewRefusedPage,
    log: (text: string) => void) {
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
    this.refusedPage = refusedPage;
    this.log = log;
    this.lastInput = undefined;
    this.lastPress = undefined;
    this.pendingUrl = undefined;
    this.committedUrl = undefined;
    this.search = undefined;
    this.favicon = new WebViewFavicon(session, check, () => this.allowed, waitAsync, t => this.emit(WebViewEventKind.Favicon, { [Resources.imageField]: t }));
  }

  public get contents(): IWebViewContents | null {
    return this.guest;
  }

  public get isRestorable(): boolean {
    return !Object.isNull(this.kept) && !this.isClosed;
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
    const pending = this.pendingScroll;
    if (!Object.isNull(pending) && pending.guest === guest) {
      this.log(Resources.formatWebViewScrollKeptPending(this.info.module, this.info.id, pending.scroll[0], pending.scroll[1]));
      this.keptScroll = pending.scroll;
      return;
    }
    const scroll = await this.readScrollAsync(guest);
    if (this.kept !== kept)
      return;
    if (Object.isNull(scroll))
      this.log(Resources.formatWebViewScrollNotKept(this.info.module, this.info.id));
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
      this.releaseCalls();
    }
    this.guest = guest;
    this.isAttached = false;
    this.isReady = false;
    this.isFocusHeld = false;
    this.isCrashed = false;
    this.refusedPages = new Map();
    this.admittedPages = new Map();
    if (!Object.isNull(previous) && !previous.isDestroyed() && previous.debugger.isAttached())
      previous.debugger.detach();
    this.listen(guest);
    this.state = JSON.stringify(this.readState(guest));
    this.restoreZoom();
    const count = this.navigationCount;
    const [failure] = await Promise.all([this.attachAsync(guest), isPristine ? this.startAsync(guest, true, count) : null]);
    if (!Object.isNull(failure)) {
      if (this.guest === guest)
        this.loseUnlessEnding(guest, failure);
      return false;
    }
    if (this.guest !== guest)
      return false;
    if (!isPristine)
      await this.startAsync(guest, false, count);
    return true;
  }

  public setAllowedOrigins(origins: readonly string[]): void {
    this.allowed = [...origins];
  }

  public setControlled(isControlled: boolean): void {
    if (this.isControlled === isControlled)
      return;
    this.isControlled = isControlled;
    this.emit(WebViewEventKind.Controlled, { [Resources.isControlledField]: isControlled });
  }

  public async navigateAsync(url: string): Promise<JsonObject | null> {
    if (this.isClosed)
      return null;
    if (Object.isNull(this.guest)) {
      this.pendingUrl = url;
      return new Promise(resolve => this.navigations.push(resolve));
    }
    this.lookupCount += 1;
    const allows = await this.allowsAsync(url);
    const guest = this.guest;
    if (!allows || this.isClosed || Object.isNull(guest)) {
      this.endLookup();
      return allows ? this.navigateAsync(url) : OpenWebView.refused(url);
    }
    this.isCrashed = false;
    this.navigationCount += 1;
    this.endLookup();
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
    if (this.isCrashed || this.isClosed)
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
    return new Promise<WebViewAnswered>(resolve => {
      const finish = (answer: WebViewAnswered): void => {
        this.endings.delete(end);
        this.attachWaits.delete(go);
        abort.abort();
        this.forgetRelayKey(relayKey);
        resolve(answer);
      };
      const end = (kind: WebViewFailureKind): void => finish(OpenWebView.fail(call, kind));
      const go = (guest: IWebViewContents): void => {
        this.attachWaits.delete(go);
        this.endings.add(end);
        this.relay(guest, call, method, params, finish);
      };
      this.waitAsync(timeoutMilliseconds, abort.signal).then(() => end(WebViewFailureKind.TimedOut), () => undefined);
      const guest = this.guest;
      if (this.isReady && this.attachWaits.size === 0 && !Object.isNull(guest))
        go(guest);
      else
        this.attachWaits.set(go, end);
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
    const isAdmitted = isFrame && !isRedirect && this.takesAdmittedPage(request);
    const allows = isAdmitted || !this.refusedRequests.delete(request.id)
      && (isPage || isFrame ? this.check.allowsNavigation(request.url, this.allowed, isFrame) : this.check.allowsRequest(request.url, this.allowed));
    if (!allows && isPage)
      this.emitRefusedNavigation(request.url, isRedirect);
    if (!allows && isFrame)
      this.refuseFrame(request.frame ?? null, request.url, isRedirect, null);
    return allows;
  }

  public allowsIconRequest(url: string): boolean {
    return this.favicon.allowsRequest(url);
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
    this.favicon.close();
    this.end(WebViewFailureKind.ViewClosed);
    this.endAttachWaits(WebViewFailureKind.ViewClosed);
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
    this.isReady = false;
    this.isFocusHeld = false;
  }

  private relay(guest: IWebViewContents, call: number, method: string, params: JsonObject, finish: (answer: WebViewAnswered) => void): void {
    const isInput = method.startsWith(Resources.inputDomainPrefix);
    const isPageCall = method !== Resources.insertTextMethod && method !== Resources.dispatchKeyEventMethod;
    const presses = this.countPresses(method, params);
    const press = presses > 0 ? Symbol(method) : null;
    const isUncounted = isInput && !Resources.pressFreeInputMethods.includes(method);
    if (isInput)
      this.relayedInputs += 1;
    if (!Object.isNull(press))
      this.relayedPresses = [...this.relayedPresses, ...Array.from({ length: presses }, () => press)];
    if (isUncounted)
      this.uncountedInputs += 1;
    if (isPageCall)
      this.startPageCall();
    const sent = isPageCall ? this.holdFocusAsync(guest).then(() => OpenWebView.relayAsync(guest, method, params)) : OpenWebView.relayAsync(guest, method, params);
    if (isInput) {
      const settle = this.untilReleased(() => this.settleInput(press, isUncounted));
      void sent.then(settle, settle);
    }
    const handled = isPageCall ? OpenWebView.afterRendererAsync(guest, sent) : sent;
    if (isPageCall) {
      const end = this.untilReleased(() => this.endPageCall());
      void handled.then(end, end);
    }
    handled.then(
      reply => finish(OpenWebView.answer(call, reply)),
      (error: unknown) => finish(new WebViewAnswered(call, null,
        new WebViewFailure(WebViewFailureKind.Protocol, Resources.webViewServerErrorCode, error instanceof Error ? error.message : String(error)))));
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
        this.noteInput(input);
    });
    guest.on(Resources.willFrameNavigateEvent, navigation => this.judgeFrame(guest, navigation));
    guest.on(Resources.didStartNavigationEvent, navigation => this.noteStart(guest, navigation));
    guest.on(Resources.willAttachWebviewEvent, event => this.prevent(guest, event, Resources.nestedViewRequest));
    guest.on(Resources.beforeInputEvent, (event, input) => {
      if (this.isBound(guest))
        this.judgeInput(guest, event, input);
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
      if (this.isBound(guest) && isMainFrame && code !== Resources.webViewAbortedLoadCode && !OpenWebView.isSourceDocument(url))
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
      this.favicon.noteNavigation();
    });
    guest.on(Resources.didStopLoadingEvent, () => {
      if (this.isBound(guest))
        this.favicon.noteStop();
    });
    guest.on(Resources.pageFaviconUpdatedEvent, (_event, favicons) => {
      if (this.isBound(guest))
        void this.favicon.updateAsync(guest, favicons);
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
    this.releases = new Set();
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
    this.isReady = false;
    this.isFocusHeld = false;
    this.endFind();
    this.end(WebViewFailureKind.Unavailable);
    this.releaseCalls();
  }

  private untilReleased(release: () => void): () => void {
    const releases = this.releases;
    const run = (): void => {
      if (releases.delete(run))
        release();
    };
    releases.add(run);
    return run;
  }

  private releaseCalls(): void {
    for (const release of [...this.releases])
      release();
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
      if (this.isBound(guest) && this.isAttached) {
        this.isReady = true;
        for (const go of [...this.attachWaits.keys()])
          go(guest);
      }
      return null;
    }
    catch (error) {
      return String(error);
    }
  }

  private endLookup(): void {
    this.lookupCount -= 1;
    if (this.lookupCount === 0)
      for (const settle of this.lookupsSettled.splice(0))
        settle();
  }

  private lookupsAsync(): Promise<void> {
    return new Promise(resolve => this.lookupsSettled.push(resolve));
  }

  private endAttachWaits(kind: WebViewFailureKind): void {
    for (const end of [...this.attachWaits.values()])
      end(kind);
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

  private async startAsync(guest: IWebViewContents, isPristine: boolean, count: number): Promise<void> {
    const pending = this.pendingUrl;
    const kept = isPristine && Object.isUndefined(pending) ? this.kept : null;
    const scroll = this.keptScroll;
    this.pendingUrl = undefined;
    this.kept = null;
    this.keptScroll = null;
    const navigations = this.navigations.splice(0);
    if (this.lookupCount > 0)
      await this.lookupsAsync();
    const answer = this.navigationCount !== count ? OpenWebView.started()
      : Object.isNull(kept) ? await this.goToAsync(pending ?? this.committedUrl) : await this.restoreAsync(guest, kept, scroll);
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
    this.pendingScroll = Object.isNull(scroll) ? null : { guest, scroll };
    void guest.restoreHistoryAsync(kept).then(() => this.scrollBackAsync(guest, kept, count, inputs, scroll), (error: unknown) => {
      if (this.navigationCount !== count || this.guest !== guest || this.isClosed)
        return Promise.resolve();
      if (guest.getURL() === String.empty) {
        void this.goToAsync(this.committedUrl);
        return Promise.resolve();
      }
      if (Object.isNull(scroll) || guest.isDestroyed() || guest.getURL() !== kept.currentUrl)
        return Promise.resolve();
      this.log(Resources.formatWebViewRestoreFailedShown(this.info.module, this.info.id, String(error)));
      return this.scrollBackAsync(guest, kept, count, inputs, scroll);
    }).finally(() => {
      if (this.pendingScroll?.guest === guest)
        this.pendingScroll = null;
    });
    return OpenWebView.started();
  }

  private async scrollBackAsync(guest: IWebViewContents, kept: WebViewHistory, count: number, inputs: number, scroll: readonly [number, number] | null): Promise<void> {
    if (Object.isNull(scroll) || (scroll[0] === 0 && scroll[1] === 0))
      return;
    const shown = await this.readLayoutScrollAsync(guest);
    if (!Object.isNull(shown) && shown[0] === scroll[0] && shown[1] === scroll[1])
      return;
    const stop = this.findScrollBackStop(guest, kept, count, inputs, shown);
    if (!Object.isNull(stop)) {
      this.log(Resources.formatWebViewScrollNotRestored(this.info.module, this.info.id, scroll[0], scroll[1], stop));
      return;
    }
    await guest.executeJavaScriptInIsolatedWorld(Resources.scrollBackWorld, [{ code: Resources.formatScrollBackScript(scroll[0], scroll[1]) }]).catch((error: unknown) =>
      this.log(Resources.formatWebViewScrollNotRestored(this.info.module, this.info.id, scroll[0], scroll[1], Resources.formatWebViewScrollScriptFailed(String(error)))));
  }

  private findScrollBackStop(guest: IWebViewContents, kept: WebViewHistory, count: number, inputs: number, shown: readonly [number, number] | null): string | null {
    if (this.guest !== guest)
      return Resources.webViewScrollUnbound;
    if (Object.isNull(shown))
      return Resources.webViewScrollUnread;
    if (this.navigationCount !== count)
      return Resources.webViewScrollNavigated;
    if (guest.getURL() !== kept.currentUrl)
      return Resources.webViewScrollRedirected;
    if (this.inputCount !== inputs)
      return Resources.webViewScrollInput;
    return shown[0] !== 0 || shown[1] !== 0 ? Resources.formatWebViewScrollShown(shown[0], shown[1]) : null;
  }

  private async readScrollAsync(guest: IWebViewContents): Promise<readonly [number, number] | null> {
    const abort = new AbortController();
    const read = this.readLayoutScrollAsync(guest);
    const late = this.waitAsync(Resources.webViewScrollReadTimeout, abort.signal).then(() => null, () => null);
    const scroll = await Promise.race([read, late]);
    abort.abort();
    return scroll;
  }

  private readLayoutScrollAsync(guest: IWebViewContents): Promise<readonly [number, number] | null> {
    return guest.debugger.sendCommand(Resources.layoutMetricsMethod, {}).then(t => OpenWebView.readScroll(t), () => null);
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
    if (!navigation.isMainFrame && this.takesRefusedPage(navigation))
      return;
    if (this.check.allowsNavigation(navigation.url, this.allowed, !navigation.isMainFrame))
      return;
    navigation.preventDefault();
    if (navigation.isMainFrame)
      this.emitRefusedNavigation(navigation.url, false);
    else
      this.refuseFrame(navigation.frame, navigation.url, false, navigation.initiator ?? null);
  }

  private takesRefusedPage(navigation: IFrameNavigation): boolean {
    const frame = navigation.frame?.frameTreeNodeId;
    if (Object.isUndefined(frame))
      return false;
    const page = this.refusedPages.get(frame);
    this.refusedPages = new Map([...this.refusedPages].filter(([key]) => key !== frame));
    this.admittedPages = new Map([...this.admittedPages].filter(([key]) => key !== frame));
    if (page !== navigation.url || navigation.initiator?.frameTreeNodeId !== frame)
      return false;
    const kept = [...this.admittedPages].slice(1 - Resources.refusedPageLimit);
    this.admittedPages = new Map([...kept, [frame, page]]);
    return true;
  }

  private takesAdmittedPage(request: IWebViewRequest): boolean {
    const frame = request.frame?.frameTreeNodeId;
    if (Object.isUndefined(frame))
      return false;
    const page = this.admittedPages.get(frame);
    this.admittedPages = new Map([...this.admittedPages].filter(([key]) => key !== frame));
    return page === request.url;
  }

  private refuseFrame(frame: IWebViewFrame | null, url: string, isRedirect: boolean, initiator: IWebViewFrame | null): void {
    if (Object.isNull(frame))
      return;
    const origin = OpenWebView.originOf(url);
    this.emit(WebViewEventKind.FrameNavigationRefused,
      { [Resources.addressField]: url, [Resources.originField]: origin, [Resources.isRedirectField]: isRedirect, [Resources.frameIdField]: frame.frameTreeNodeId });
    const isOwn = !isRedirect && initiator?.frameTreeNodeId === frame.frameTreeNodeId;
    const shown = origin === Resources.nullOrigin ? url : origin;
    const page = this.refusedPage.format(isOwn ? shown : null, randomUUID());
    const kept = [...this.refusedPages].filter(([key]) => key !== frame.frameTreeNodeId).slice(1 - Resources.refusedPageLimit);
    this.refusedPages = new Map([...kept, [frame.frameTreeNodeId, page]]);
    void frame.executeJavaScript(Resources.formatRefusedPageScript(page)).catch(() => undefined);
  }

  private noteStart(guest: IWebViewContents, navigation: IWindowNavigation): void {
    if (navigation.isMainFrame && !navigation.isSameDocument) {
      this.refusedPages = new Map();
      this.admittedPages = new Map();
    }
    if (this.isBound(guest) && navigation.isMainFrame && !navigation.isSameDocument && OpenWebView.isSourceDocument(navigation.url))
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
      [Resources.originField]: origin === Resources.nullOrigin ? null : origin,
      ...Object.isUndefined(details.disposition) ? {} : { [Resources.dispositionField]: details.disposition },
      [Resources.fromPressField]: this.takePress(now)
    });
  }

  private takePress(now: number): boolean {
    const isFromPress = !Object.isUndefined(this.lastPress) && now - this.lastPress <= Resources.recentInputMilliseconds;
    this.lastPress = undefined;
    return isFromPress;
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

  private noteInput(input: IWebViewInputEvent): void {
    const type = input.type;
    if (!Resources.pointerMoveTypes.includes(type))
      this.inputCount += 1;
    const isPress = Resources.personPressTypes.includes(type);
    if (isPress && this.relayedPresses.length > 0) {
      this.relayedPresses = this.relayedPresses.slice(1);
      return;
    }
    const isPersonInput = Resources.personInputTypes.includes(type);
    if (isPersonInput && this.relayCopies > 0)
      this.relayCopies -= 1;
    else if (this.relayedInputs === 0 && isPersonInput) {
      const now = this.now();
      this.lastInput = now;
      if (Object.isUndefined(input.key) || !Resources.nonActivatingKeys.includes(input.key))
        this.lastPress = now;
    }
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
    this.endAttachWaits(WebViewFailureKind.Crashed);
    this.endFind();
    this.emit(WebViewEventKind.Crashed);
  }

  private detach(guest: IWebViewContents): void {
    this.isAttached = false;
    this.isReady = false;
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
    if (failure.includes(Resources.targetClosedError))
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

  private judgeInput(guest: IWebViewContents, event: IPreventableEvent, input: IWebViewInput): void {
    const isDown = Resources.keyDownInputs.includes(input.type);
    if (!isDown && input.type !== Resources.keyUpType)
      return;
    const stroke: IKeyStroke = { key: input.key, code: input.code, ctrlKey: input.control, altKey: input.alt, shiftKey: input.shift, metaKey: input.meta };
    const replay = isDown ? this.replays.findIndex(t => OpenWebView.isSameStroke(t, stroke)) : -1;
    if (replay >= 0) {
      this.replays.splice(replay, 1);
      return;
    }
    if (this.isAnswerAwaited) {
      event.preventDefault();
      const heldRelayKey = isDown ? this.relayKeys.find(t => OpenWebView.isSameStroke(t, stroke)) : undefined;
      this.forgetRelayKey(heldRelayKey ?? null);
      this.heldInputs = [...this.heldInputs, [guest, input, !Object.isUndefined(heldRelayKey)]];
      return;
    }
    if (!isDown) {
      this.declinedKey = null;
      return;
    }
    if (input.isAutoRepeat && !Object.isNull(this.declinedKey) && OpenWebView.isSameStroke(this.declinedKey, stroke))
      return;
    const relayKey = this.relayKeys.find(t => OpenWebView.isSameStroke(t, stroke));
    if (!Object.isUndefined(relayKey))
      return this.forgetRelayKey(relayKey);
    const name = this.declaration.findKey(stroke, this.platform, guest.isLoading());
    if (Object.isNull(name) && !this.isShortcut(stroke))
      return this.judgeZoomKey(event, stroke);
    event.preventDefault();
    if (input.isAutoRepeat)
      return;
    if (Object.isNull(name))
      this.forward(guest, stroke, input);
    else
      this.emit(WebViewEventKind.Key, { [Resources.nameField]: name });
  }

  private forward(guest: IWebViewContents, stroke: IKeyStroke, input: IWebViewInput): void {
    this.isAnswerAwaited = true;
    this.pressShortcut(stroke, hasRun => this.takeAnswer(guest, input, hasRun));
  }

  private takeAnswer(guest: IWebViewContents, input: IWebViewInput, hasRun: boolean): void {
    this.isAnswerAwaited = false;
    if (!hasRun)
      this.replay(guest, input);
    const held = this.heldInputs;
    this.heldInputs = [];
    for (const [heldBy, heldInput, isRelayed] of held)
      this.send(heldBy, heldInput, isRelayed);
  }

  private replay(guest: IWebViewContents, input: IWebViewInput): void {
    if (!this.isBound(guest))
      return;
    const stroke: IKeyStroke = { key: input.key, code: String.empty, ctrlKey: input.control, altKey: input.alt, shiftKey: input.shift, metaKey: input.meta };
    this.declinedKey = stroke;
    this.replays.push(stroke);
    for (const event of WebViewKeyInput.fromInput(input, this.platform))
      guest.sendInputEvent(event);
  }

  private send(guest: IWebViewContents, input: IWebViewInput, isRelayed: boolean): void {
    if (!this.isBound(guest))
      return;
    const events = WebViewKeyInput.fromInput(input, this.platform);
    if (isRelayed) {
      this.replays.push({ key: input.key, code: String.empty, ctrlKey: input.control, altKey: input.alt, shiftKey: input.shift, metaKey: input.meta });
      this.relayCopies += events.filter(t => Resources.personInputTypes.includes(t.type)).length;
    }
    for (const event of events)
      guest.sendInputEvent(event);
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
    return { [Resources.isTimedOutField]: true };
  }

  private static ended(): JsonObject {
    return { [Resources.isEndedField]: true };
  }

  private static isSourceDocument(url: string): boolean {
    const parsed = URL.parse(url);
    return parsed?.protocol === Resources.aboutScheme && parsed.pathname === Resources.sourceDocumentPath;
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
