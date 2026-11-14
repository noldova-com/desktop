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

import { WebViewFailureKind } from "../enums/web-view-failure-kind.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class WebViewFailure {
  private static readonly FIELDS: readonly string[] = [Resources.kindField, Resources.codeField, Resources.messageField];
  private static readonly KINDS: readonly WebViewFailureKind[] = Object.values(WebViewFailureKind);

  public readonly kind: WebViewFailureKind;
  public readonly code: number | null;
  public readonly message: string | null;

  public constructor(kind: WebViewFailureKind, code: number | null = null, message: string | null = null) {
    const isProtocol = kind === WebViewFailureKind.Protocol;
    if (isProtocol !== !Object.isNull(code) || isProtocol !== !Object.isNull(message) || (!Object.isNull(code) && !Number.isSafeInteger(code)))
      throw new ArgumentException(Resources.webViewFailureInvalid, Resources.codeField);

    this.kind = kind;
    this.code = code;
    this.message = message;
  }

  public static fromJson(value: unknown, path?: string): WebViewFailure {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewFailure.FIELDS);
    return WireContract.create(reader, () => new WebViewFailure(
      reader.readOneOf(Resources.kindField, WebViewFailure.KINDS),
      reader.hasField(Resources.codeField) ? reader.readInteger(Resources.codeField) : null,
      reader.hasField(Resources.messageField) ? reader.readString(Resources.messageField) : null));
  }

  public toJson(): JsonObject {
    return {
      [Resources.kindField]: this.kind,
      ...Object.isNull(this.code) ? {} : { [Resources.codeField]: this.code },
      ...Object.isNull(this.message) ? {} : { [Resources.messageField]: this.message }
    };
  }
}
