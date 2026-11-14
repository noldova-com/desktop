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
import { WebViewPane } from "./web-view-pane.js";

export class WebViewInfo {
  private static readonly FIELDS: readonly string[] = [Resources.idField, Resources.moduleField, Resources.paneField, Resources.profileKeyField];

  public readonly id: string;
  public readonly module: string;
  public readonly pane: WebViewPane;
  public readonly profileKey: string;

  public constructor(id: string, module: string, pane: WebViewPane, profileKey: string) {
    if (String.isNullOrWhitespace(id))
      throw new ArgumentException(Resources.webViewIdInvalid, Resources.idField);
    if (!Resources.ownerPattern.test(module) || module === Resources.shellOwner || pane.name.owner !== module)
      throw new ArgumentException(Resources.webViewModuleInvalid, Resources.moduleField);
    if (!Resources.profileKeyPattern.test(profileKey))
      throw new ArgumentException(Resources.profileKeyInvalid, Resources.profileKeyField);

    this.id = id;
    this.module = module;
    this.pane = pane;
    this.profileKey = profileKey;
  }

  public static fromJson(value: unknown, path?: string): WebViewInfo {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewInfo.FIELDS);
    return WireContract.create(reader, () => new WebViewInfo(
      reader.readString(Resources.idField),
      reader.readString(Resources.moduleField),
      WebViewPane.fromJson(reader.readObject(Resources.paneField).toJson(), Resources.formatFieldPath(reader.path, Resources.paneField)),
      reader.readString(Resources.profileKeyField)));
  }

  public toJson(): JsonObject {
    return { [Resources.idField]: this.id, [Resources.moduleField]: this.module, [Resources.paneField]: this.pane.toJson(), [Resources.profileKeyField]: this.profileKey };
  }
}
