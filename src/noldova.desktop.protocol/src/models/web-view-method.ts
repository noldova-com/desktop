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

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { WebViewParameter } from "./web-view-parameter.js";

export class WebViewMethod {
  private static readonly FIELDS: readonly string[] = [Resources.nameField, Resources.parametersField];

  public readonly name: string;
  public readonly parameters: ReadonlyMap<string, WebViewParameter>;

  public constructor(name: string, parameters: ReadonlyMap<string, WebViewParameter> = new Map<string, WebViewParameter>()) {
    if (!Resources.webViewMethodPattern.test(name))
      throw new ArgumentException(Resources.webViewMethodNameInvalid, Resources.nameField);
    if (WebViewMethod.isRefused(name))
      throw new ArgumentException(Resources.formatWebViewMethodRefused(name), Resources.nameField);
    const badName = [...parameters.keys()].find(t => !Resources.memberPattern.test(t));
    if (!Object.isUndefined(badName))
      throw new ArgumentException(Resources.webViewParameterNameInvalid, Resources.formatFieldPath(Resources.parametersField, badName));

    this.name = name;
    this.parameters = new Map(parameters);
  }

  public static isRefused(name: string): boolean {
    return Resources.webViewRefusedMethods.includes(name) || Resources.webViewRefusedDomains.includes(name.slice(0, name.indexOf(Resources.nameSeparator)));
  }

  public static fromJson(value: unknown, path?: string): WebViewMethod {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewMethod.FIELDS);
    return WireContract.create(reader, () => new WebViewMethod(
      reader.readString(Resources.nameField),
      reader.hasField(Resources.parametersField) ? WebViewParameter.readFields(reader.readObject(Resources.parametersField)) : undefined));
  }

  public allows(parameters: unknown): boolean {
    return WebViewParameter.allowsFields(this.parameters, parameters);
  }

  public toJson(): JsonObject {
    return {
      [Resources.nameField]: this.name,
      ...this.parameters.size === 0 ? {} : { [Resources.parametersField]: WebViewParameter.fieldsToJson(this.parameters) }
    };
  }
}
