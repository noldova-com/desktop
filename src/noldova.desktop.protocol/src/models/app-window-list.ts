/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonReader, type JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";
import { WireContract } from "../services/wire-contract.js";
import { AppWindow } from "./app-window.js";

export class AppWindowList {
  private static readonly FIELDS: readonly string[] = [Resources.windowsField];

  public readonly windows: readonly AppWindow[];

  public constructor(windows: readonly AppWindow[]) {
    this.windows = [...windows];
  }

  public static fromJson(value: unknown, path?: string): AppWindowList {
    const reader = JsonReader.fromValue(value, path);
    WireContract.requireKnownFields(reader, AppWindowList.FIELDS);
    return WireContract.create(reader, () => new AppWindowList(
      reader.readObjectArray(Resources.windowsField).map(t => AppWindow.fromJson(t.toJson(), t.path))));
  }

  public toJson(): JsonObject {
    return { [Resources.windowsField]: this.windows.map(t => t.toJson()) };
  }
}
