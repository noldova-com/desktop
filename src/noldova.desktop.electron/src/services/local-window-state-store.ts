/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import type { IDeviceFileStore } from "../interfaces/i-device-file-store.js";
import type { IWindowStateStore } from "../interfaces/i-window-state-store.js";
import { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";

export class LocalWindowStateStore implements IWindowStateStore {
  private readonly file: IDeviceFileStore;
  private readonly log: (text: string) => void;

  public constructor(file: IDeviceFileStore, log: (text: string) => void) {
    this.file = file;
    this.log = log;
  }

  public async readStateAsync(): Promise<WindowState | null> {
    try {
      const saved = await this.file.readAsync();
      return Object.isNull(saved) ? null : WindowState.fromJson(saved);
    }
    catch (error) {
      this.log(Resources.formatLocalBoundsUnreadable(String(error)));
      return null;
    }
  }

  public async readAsync(): Promise<JsonObject | null> {
    return (await this.readStateAsync())?.toJson() ?? null;
  }

  public writeAsync(value: JsonObject): Promise<void> {
    return this.file.writeAsync(value);
  }

  public async keepAsync(value: JsonObject): Promise<void> {
    await this.file.writeAsync(value).catch((error: unknown) => this.log(Resources.formatLocalBoundsUnkept(String(error))));
  }
}
