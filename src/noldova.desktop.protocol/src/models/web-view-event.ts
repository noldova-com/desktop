/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { WebViewEventKind } from "../enums/web-view-event-kind.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { WebViewPane } from "./web-view-pane.js";

export class WebViewEvent {
  private static readonly FIELDS: readonly string[] = [Resources.moduleField, Resources.viewField, Resources.kindField, Resources.detailsField];
  private static readonly KINDS: readonly WebViewEventKind[] = Object.values(WebViewEventKind);
  private static readonly TEXT: (value: unknown) => boolean = t => Object.isString(t);
  private static readonly TEXT_OR_NULL: (value: unknown) => boolean = t => Object.isString(t) || Object.isNull(t);
  private static readonly TEXT_OR_ABSENT: (value: unknown) => boolean = t => Object.isString(t) || Object.isUndefined(t);
  private static readonly FLAG: (value: unknown) => boolean = t => Object.isBoolean(t);
  private static readonly FLAG_OR_ABSENT: (value: unknown) => boolean = t => Object.isBoolean(t) || Object.isUndefined(t);
  private static readonly FRAME: (value: unknown) => boolean = t => Number.isSafeInteger(t) && Number(t) > 0;
  private static readonly WHOLE: (value: unknown) => boolean = t => Number.isSafeInteger(t);
  private static readonly OBJECT: (value: unknown) => boolean = t => Object.isPlainObject(t);
  private static readonly COUNT: (value: unknown) => boolean = t => Number.isSafeInteger(t) && Number(t) >= 0;
  private static readonly FACTOR: (value: unknown) => boolean = t => Object.isNumber(t) && t >= Resources.webViewZoomMinimum && t <= Resources.webViewZoomMaximum;
  private static readonly ICON: (value: unknown) => boolean = t => Object.isNull(t) || (Object.isString(t) && t.length <= Resources.webViewIconLengthLimit && Resources.webViewIconPattern.test(t));
  private static readonly DETAILS: Readonly<Record<WebViewEventKind, ReadonlyMap<string, (value: unknown) => boolean>>> = {
    [WebViewEventKind.Opened]: new Map([[Resources.paneField, WebViewEvent.OBJECT], [Resources.profileKeyField, WebViewEvent.TEXT]]),
    [WebViewEventKind.Closed]: new Map(),
    [WebViewEventKind.State]: new Map([
      [Resources.addressField, WebViewEvent.TEXT], [Resources.titleField, WebViewEvent.TEXT], [Resources.isLoadingField, WebViewEvent.FLAG],
      [Resources.canGoBackField, WebViewEvent.FLAG], [Resources.canGoForwardField, WebViewEvent.FLAG]
    ]),
    [WebViewEventKind.LoadFailed]: new Map([[Resources.addressField, WebViewEvent.TEXT], [Resources.codeField, WebViewEvent.WHOLE], [Resources.descriptionField, WebViewEvent.TEXT]]),
    [WebViewEventKind.NavigationRefused]: new Map([[Resources.addressField, WebViewEvent.TEXT], [Resources.originField, WebViewEvent.TEXT], [Resources.isRedirectField, WebViewEvent.FLAG]]),
    [WebViewEventKind.FrameNavigationRefused]: new Map([
      [Resources.addressField, WebViewEvent.TEXT], [Resources.originField, WebViewEvent.TEXT], [Resources.isRedirectField, WebViewEvent.FLAG], [Resources.frameIdField, WebViewEvent.FRAME]
    ]),
    [WebViewEventKind.Crashed]: new Map(),
    [WebViewEventKind.ProfileCleared]: new Map([[Resources.profileKeyField, WebViewEvent.TEXT]]),
    [WebViewEventKind.RequestRefused]: new Map([[Resources.requestField, WebViewEvent.TEXT], [Resources.originField, WebViewEvent.TEXT]]),
    [WebViewEventKind.NewWindowRequested]: new Map([[Resources.addressField, WebViewEvent.TEXT], [Resources.hadRecentInputField, WebViewEvent.FLAG], [Resources.originField, WebViewEvent.TEXT_OR_NULL],
      [Resources.dispositionField, WebViewEvent.TEXT_OR_ABSENT], [Resources.fromPressField, WebViewEvent.FLAG_OR_ABSENT]]),
    [WebViewEventKind.Protocol]: new Map([[Resources.methodField, WebViewEvent.TEXT], [Resources.paramsField, WebViewEvent.OBJECT], [Resources.isCutField, WebViewEvent.FLAG]]),
    [WebViewEventKind.Dropped]: new Map([[Resources.countField, WebViewEvent.WHOLE]]),
    [WebViewEventKind.Key]: new Map([[Resources.nameField, WebViewEvent.TEXT]]),
    [WebViewEventKind.Zoom]: new Map([[Resources.factorField, WebViewEvent.FACTOR]]),
    [WebViewEventKind.Found]: new Map([[Resources.matchesField, WebViewEvent.COUNT], [Resources.activeField, WebViewEvent.COUNT]]),
    [WebViewEventKind.Favicon]: new Map([[Resources.imageField, WebViewEvent.ICON]]),
    [WebViewEventKind.Controlled]: new Map([[Resources.isControlledField, WebViewEvent.FLAG]])
  };

  public readonly module: string;
  public readonly view: string;
  public readonly kind: WebViewEventKind;
  public readonly details: JsonObject;

  public constructor(module: string, view: string, kind: WebViewEventKind, details: JsonObject = {}) {
    if (!Resources.ownerPattern.test(module) || module === Resources.shellOwner)
      throw new ArgumentException(Resources.webViewModuleInvalid, Resources.moduleField);
    if (String.isNullOrWhitespace(view))
      throw new ArgumentException(Resources.webViewIdInvalid, Resources.viewField);
    if (!WebViewEvent.hasDetails(kind, details))
      throw new ArgumentException(Resources.formatWebViewEventInvalid(kind), Resources.detailsField);

    this.module = module;
    this.view = view;
    this.kind = kind;
    this.details = { ...details };
  }

  public static fromJson(value: unknown, path?: string): WebViewEvent {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewEvent.FIELDS);
    return WireContract.create(reader, () => new WebViewEvent(
      reader.readString(Resources.moduleField),
      reader.readString(Resources.viewField),
      reader.readOneOf(Resources.kindField, WebViewEvent.KINDS),
      reader.hasField(Resources.detailsField) ? reader.readObject(Resources.detailsField).toJson() : {}));
  }

  public toJson(): JsonObject {
    return {
      [Resources.moduleField]: this.module,
      [Resources.viewField]: this.view,
      [Resources.kindField]: this.kind,
      ...Object.keys(this.details).length === 0 ? {} : { [Resources.detailsField]: this.details }
    };
  }

  private static hasDetails(kind: WebViewEventKind, details: JsonObject): boolean {
    const types = WebViewEvent.DETAILS[kind];
    const names = Object.keys(details);
    if (!names.every(t => types.has(t)))
      return false;
    if (![...types].every(([name, isOfType]) => isOfType(details[name])))
      return false;
    const profileKey = details[Resources.profileKeyField];
    const request = details[Resources.requestField];
    return (Object.isUndefined(profileKey) || Resources.profileKeyPattern.test(String(profileKey)))
      && (Object.isUndefined(request) || Resources.webViewRefusedRequests.includes(String(request)))
      && (kind !== WebViewEventKind.Opened || WebViewEvent.isPane(details[Resources.paneField]))
      && (kind !== WebViewEventKind.Dropped || Number(details[Resources.countField]) > 0)
      && (kind !== WebViewEventKind.Found || Number(details[Resources.activeField]) <= Number(details[Resources.matchesField]));
  }

  private static isPane(value: unknown): boolean {
    try {
      WebViewPane.fromJson(value);
      return true;
    }
    catch {
      return false;
    }
  }
}
