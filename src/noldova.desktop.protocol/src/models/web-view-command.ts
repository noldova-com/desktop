/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { WebViewAction } from "../enums/web-view-action.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class WebViewCommand {
  private static readonly FIELDS: readonly string[] = [Resources.callField, Resources.moduleField, Resources.actionField, Resources.viewField, Resources.valueField];
  private static readonly SEND_FIELDS: readonly string[] = [Resources.methodField, Resources.paramsField, Resources.timeoutField];
  private static readonly ACTIONS: readonly WebViewAction[] = Object.values(WebViewAction);
  private static readonly WITHOUT_VIEW: readonly WebViewAction[] = [WebViewAction.List, WebViewAction.ClearProfile];

  public readonly call: number;
  public readonly module: string;
  public readonly action: WebViewAction;
  public readonly view: string | null;
  public readonly value: JsonValue;

  public constructor(call: number, module: string, action: WebViewAction, view: string | null = null, value: JsonValue = null) {
    if (!Number.isSafeInteger(call) || call <= 0)
      throw new ArgumentException(Resources.webViewCallInvalid, Resources.callField);
    if (!Resources.ownerPattern.test(module) || module === Resources.shellOwner)
      throw new ArgumentException(Resources.webViewModuleInvalid, Resources.moduleField);
    if (WebViewCommand.WITHOUT_VIEW.includes(action) !== Object.isNull(view) || (!Object.isNull(view) && String.isNullOrWhitespace(view)))
      throw new ArgumentException(Resources.webViewIdInvalid, Resources.viewField);
    if (!WebViewCommand.hasValue(action, value))
      throw new ArgumentException(Resources.formatWebViewValueInvalid(action), Resources.valueField);

    this.call = call;
    this.module = module;
    this.action = action;
    this.view = view;
    this.value = value;
  }

  public static fromJson(value: unknown, path?: string): WebViewCommand {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewCommand.FIELDS);
    return WireContract.create(reader, () => new WebViewCommand(
      reader.readInteger(Resources.callField),
      reader.readString(Resources.moduleField),
      reader.readOneOf(Resources.actionField, WebViewCommand.ACTIONS),
      reader.hasField(Resources.viewField) ? reader.readString(Resources.viewField) : null,
      reader.hasField(Resources.valueField) ? reader.readValue(Resources.valueField) : null));
  }

  public toJson(): JsonObject {
    return {
      [Resources.callField]: this.call,
      [Resources.moduleField]: this.module,
      [Resources.actionField]: this.action,
      ...Object.isNull(this.view) ? {} : { [Resources.viewField]: this.view },
      ...Object.isNull(this.value) ? {} : { [Resources.valueField]: this.value }
    };
  }

  private static hasValue(action: WebViewAction, value: JsonValue): boolean {
    switch (action) {
      case WebViewAction.Navigate:
        return Object.isString(value) && value.length > 0 && value.length <= Resources.webViewAddressLimit;
      case WebViewAction.SetAllowedOrigins:
        return Array.isArray(value) && value.every(t => Object.isString(t) && !String.isNullOrWhitespace(t));
      case WebViewAction.ClearProfile:
        return Object.isString(value) && Resources.profileKeyPattern.test(value);
      case WebViewAction.Send:
        return WebViewCommand.isSend(value);
      case WebViewAction.SetControlled:
        return Object.isBoolean(value);
      default:
        return Object.isNull(value);
    }
  }

  private static isSend(value: JsonValue): boolean {
    if (!Object.isPlainObject(value))
      return false;
    const send = JsonReader.fromValue(value).toJson();
    if (Object.keys(send).some(t => !WebViewCommand.SEND_FIELDS.includes(t)))
      return false;
    const params = send[Resources.paramsField];
    const timeout = send[Resources.timeoutField];
    return Object.isString(send[Resources.methodField]) && Object.isPlainObject(params)
      && Number.isSafeInteger(timeout) && Number(timeout) > 0 && Number(timeout) <= Resources.webViewTimeoutLimit;
  }
}
