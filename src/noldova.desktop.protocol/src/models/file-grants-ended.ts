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

export class FileGrantsEnded {
  private static readonly FIELDS: readonly string[] = [Resources.windowField, Resources.pageField];

  public readonly window: number;
  public readonly page: number;

  public constructor(window: number, page: number) {
    if (!Number.isInteger(window) || window <= 0)
      throw new ArgumentOutOfRangeException(Resources.windowField, window, Resources.windowInvalid);
    if (!Number.isInteger(page) || page <= 0)
      throw new ArgumentOutOfRangeException(Resources.pageField, page, Resources.pageInvalid);

    this.window = window;
    this.page = page;
  }

  public static fromJson(value: unknown, path?: string): FileGrantsEnded {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, FileGrantsEnded.FIELDS);
    return WireContract.create(reader, () => new FileGrantsEnded(reader.readInteger(Resources.windowField), reader.readInteger(Resources.pageField)));
  }

  public toJson(): JsonObject {
    return { [Resources.windowField]: this.window, [Resources.pageField]: this.page };
  }
}
