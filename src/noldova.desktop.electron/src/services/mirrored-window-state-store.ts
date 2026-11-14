/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import type { IWindowStateStore } from "../interfaces/i-window-state-store.js";
import type { LocalWindowStateStore } from "./local-window-state-store.js";

export class MirroredWindowStateStore implements IWindowStateStore {
  private readonly primary: IWindowStateStore;
  private readonly mirror: LocalWindowStateStore;

  public constructor(primary: IWindowStateStore, mirror: LocalWindowStateStore) {
    this.primary = primary;
    this.mirror = mirror;
  }

  public async readAsync(): Promise<JsonObject | null> {
    const value = await this.primary.readAsync();
    if (!Object.isNull(value))
      await this.mirror.keepAsync(value);
    return value;
  }

  public async writeAsync(value: JsonObject): Promise<void> {
    await Promise.all([this.primary.writeAsync(value), this.mirror.writeAsync(value)]);
  }
}
