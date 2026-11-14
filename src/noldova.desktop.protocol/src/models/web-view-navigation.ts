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

import { WebViewNavigationKind } from "../enums/web-view-navigation-kind.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class WebViewNavigation {
  private static readonly FIELDS: readonly string[] = [Resources.kindField, Resources.originField];
  private static readonly KINDS: readonly WebViewNavigationKind[] = Object.values(WebViewNavigationKind);

  public readonly kind: WebViewNavigationKind;
  public readonly origin: string | null;

  public constructor(kind: WebViewNavigationKind, origin: string | null = null) {
    if ((kind === WebViewNavigationKind.Refused) !== !Object.isNull(origin))
      throw new ArgumentException(Resources.webViewNavigationInvalid, Resources.originField);

    this.kind = kind;
    this.origin = origin;
  }

  public static fromJson(value: unknown, path?: string): WebViewNavigation {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewNavigation.FIELDS);
    return WireContract.create(reader, () => new WebViewNavigation(
      reader.readOneOf(Resources.kindField, WebViewNavigation.KINDS),
      reader.hasField(Resources.originField) ? reader.readString(Resources.originField) : null));
  }

  public toJson(): JsonObject {
    return { [Resources.kindField]: this.kind, ...Object.isNull(this.origin) ? {} : { [Resources.originField]: this.origin } };
  }
}
