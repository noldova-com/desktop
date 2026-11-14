/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject, type JsonValue } from "@noldova/context.json";

import { WireMessageKind } from "../enums/wire-message-kind.js";
import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { QualifiedName } from "./qualified-name.js";
import { WireMessage } from "./wire-message.js";

export class Event extends WireMessage {
  public override readonly kind: WireMessageKind = WireMessageKind.Event;
  public readonly name: QualifiedName;
  public readonly payload: JsonValue;
  public readonly window: number | undefined;

  public constructor(name: QualifiedName, payload: JsonValue, window?: number) {
    super();
    if (!Object.isUndefined(window) && (!Number.isInteger(window) || window <= 0))
      throw new ArgumentOutOfRangeException(Resources.windowField, window, Resources.windowInvalid);

    this.name = name;
    this.payload = payload;
    this.window = window;
  }

  public static fromJson(value: unknown, path?: string): Event {
    const reader = JsonReader.fromValue(value, path);
    return WireContract.create(reader, () => new Event(
      QualifiedName.parse(reader.readString(Resources.nameField), Resources.nameField),
      reader.readValue(Resources.payloadField),
      reader.hasField(Resources.windowField) ? reader.readInteger(Resources.windowField) : undefined));
  }

  protected override toJsonFields(): JsonObject {
    const fields = { [Resources.nameField]: this.name.text, [Resources.payloadField]: this.payload };
    return Object.isUndefined(this.window) ? fields : { ...fields, [Resources.windowField]: this.window };
  }
}
