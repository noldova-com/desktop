/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { WireMessageKind } from "../enums/wire-message-kind.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { QualifiedName } from "./qualified-name.js";
import { WireMessage } from "./wire-message.js";

export class Request extends WireMessage {
  public override readonly kind: WireMessageKind = WireMessageKind.Request;
  public readonly id: string;
  public readonly method: QualifiedName;
  public readonly payload: JsonValue;
  public readonly timeoutMilliseconds: number | undefined;
  public readonly window: number | undefined;
  public readonly page: number | undefined;

  public constructor(id: string, method: QualifiedName, payload: JsonValue, timeoutMilliseconds?: number, window?: number, page?: number) {
    super();
    ArgumentException.throwIfNullOrWhitespace(id, Resources.idField);
    if (!Object.isUndefined(timeoutMilliseconds) && (!Number.isInteger(timeoutMilliseconds) || timeoutMilliseconds <= 0))
      throw new ArgumentOutOfRangeException(Resources.timeoutField, timeoutMilliseconds, Resources.timeoutInvalid);
    if (!Object.isUndefined(window) && (!Number.isInteger(window) || window <= 0))
      throw new ArgumentOutOfRangeException(Resources.windowField, window, Resources.windowInvalid);
    if (!Object.isUndefined(page) && (Object.isUndefined(window) || !Number.isInteger(page) || page <= 0))
      throw new ArgumentOutOfRangeException(Resources.pageField, page, Resources.pageInvalid);

    this.id = id;
    this.method = method;
    this.payload = payload;
    this.timeoutMilliseconds = timeoutMilliseconds;
    this.window = window;
    this.page = page;
  }

  public static fromJson(value: unknown, path?: string): Request {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new Request(
      reader.readString(Resources.idField),
      QualifiedName.parse(reader.readString(Resources.methodField), Resources.methodField),
      reader.readValue(Resources.payloadField),
      reader.hasField(Resources.timeoutField) ? reader.readInteger(Resources.timeoutField) : undefined,
      reader.hasField(Resources.windowField) ? reader.readInteger(Resources.windowField) : undefined,
      reader.hasField(Resources.pageField) ? reader.readInteger(Resources.pageField) : undefined));
  }

  protected override toJsonFields(): JsonObject {
    return {
      [Resources.idField]: this.id,
      [Resources.methodField]: this.method.text,
      [Resources.payloadField]: this.payload,
      ...Object.isUndefined(this.timeoutMilliseconds) ? {} : { [Resources.timeoutField]: this.timeoutMilliseconds },
      ...Object.isUndefined(this.window) ? {} : { [Resources.windowField]: this.window },
      ...Object.isUndefined(this.page) ? {} : { [Resources.pageField]: this.page }
    };
  }
}
