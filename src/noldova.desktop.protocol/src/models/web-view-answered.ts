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

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { WebViewFailure } from "./web-view-failure.js";

export class WebViewAnswered {
  private static readonly FIELDS: readonly string[] = [Resources.callField, Resources.valueField, Resources.failureField];

  public readonly call: number;
  public readonly value: JsonValue;
  public readonly failure: WebViewFailure | null;

  public constructor(call: number, value: JsonValue = null, failure: WebViewFailure | null = null) {
    if (!Number.isSafeInteger(call) || call <= 0)
      throw new ArgumentException(Resources.webViewCallInvalid, Resources.callField);
    if (!Object.isNull(failure) && !Object.isNull(value))
      throw new ArgumentException(Resources.responseOutcomeAmbiguous, Resources.valueField);

    this.call = call;
    this.value = value;
    this.failure = failure;
  }

  public static fromJson(value: unknown, path?: string): WebViewAnswered {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WebViewAnswered.FIELDS);
    return WireContract.create(reader, () => new WebViewAnswered(
      reader.readInteger(Resources.callField),
      reader.hasField(Resources.valueField) ? reader.readValue(Resources.valueField) : null,
      reader.hasField(Resources.failureField)
        ? WebViewFailure.fromJson(reader.readObject(Resources.failureField).toJson(), Resources.formatFieldPath(reader.path, Resources.failureField))
        : null));
  }

  public toJson(): JsonObject {
    return {
      [Resources.callField]: this.call,
      ...Object.isNull(this.value) ? {} : { [Resources.valueField]: this.value },
      ...Object.isNull(this.failure) ? {} : { [Resources.failureField]: this.failure.toJson() }
    };
  }
}
