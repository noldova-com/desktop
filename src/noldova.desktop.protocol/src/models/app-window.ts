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

export class AppWindow {
  private static readonly FIELDS: readonly string[] = [Resources.handleField, Resources.processIdField];

  public readonly handle: number | null;
  public readonly processId: number;

  public constructor(handle: number | null, processId: number) {
    if (!Object.isNull(handle) && (!Number.isSafeInteger(handle) || handle < 1))
      throw new ArgumentException(Resources.appWindowHandleInvalid, Resources.handleField);
    if (!Number.isSafeInteger(processId) || processId < 1)
      throw new ArgumentException(Resources.appWindowProcessIdInvalid, Resources.processIdField);

    this.handle = handle;
    this.processId = processId;
  }

  public static fromJson(value: unknown, path?: string): AppWindow {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, AppWindow.FIELDS);
    return WireContract.create(reader, () => new AppWindow(
      Object.isNull(reader.readValue(Resources.handleField)) ? null : reader.readInteger(Resources.handleField),
      reader.readInteger(Resources.processIdField)));
  }

  public toJson(): JsonObject {
    return { [Resources.handleField]: this.handle, [Resources.processIdField]: this.processId };
  }
}
