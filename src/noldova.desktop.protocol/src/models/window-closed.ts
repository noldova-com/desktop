/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";

export class WindowClosed {
  private static readonly FIELDS: readonly string[] = [Resources.windowField];

  public readonly window: number;

  public constructor(window: number) {
    if (!Number.isInteger(window) || window <= 0)
      throw new ArgumentOutOfRangeException(Resources.windowField, window, Resources.windowInvalid);

    this.window = window;
  }

  public static fromJson(value: unknown, path?: string): WindowClosed {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, WindowClosed.FIELDS);
    return WireContract.create(reader, () => new WindowClosed(reader.readInteger(Resources.windowField)));
  }

  public toJson(): JsonObject {
    return { [Resources.windowField]: this.window };
  }
}
