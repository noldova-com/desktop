/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";

import type { IDeviceFileStore } from "../interfaces/i-device-file-store.js";
import { WindowAppearance } from "../models/window-appearance.js";
import { Resources } from "../resources.js";
import type { OpenWindow } from "./open-window.js";
import type { WindowFactory } from "./window-factory.js";

export class AppearanceKeeper {
  private readonly store: IDeviceFileStore;
  private readonly factory: WindowFactory;
  private readonly log: (text: string) => void;
  private kept: JsonObject | null;

  public constructor(store: IDeviceFileStore, factory: WindowFactory, log: (text: string) => void) {
    this.store = store;
    this.factory = factory;
    this.log = log;
    this.kept = null;
  }

  public get current(): JsonObject | null {
    return this.kept;
  }

  public async readAsync(): Promise<void> {
    try {
      this.kept = await this.store.readAsync();
    }
    catch (error) {
      this.log(Resources.formatAppearanceUnread(String(error)));
    }
  }

  public keep(open: OpenWindow | null, preferences: unknown): void {
    if (Object.isNull(open))
      return;
    let json: JsonObject;
    try {
      json = JsonReader.fromValue(preferences).toJson();
    }
    catch (error) {
      this.log(Resources.formatPreferencesRejected(String(error)));
      return;
    }
    if (JSON.stringify(json).length > Resources.appearanceLimit) {
      this.log(Resources.formatPreferencesRejected(Resources.appearanceTooLarge));
      return;
    }
    this.kept = json;
    this.store.writeAsync(json).catch((error: unknown) => this.log(Resources.formatAppearanceUnsaved(String(error))));
  }

  public repaint(open: OpenWindow | null, appearance: unknown): OpenWindow | null {
    if (Object.isNull(open))
      return null;
    try {
      const painted = WindowAppearance.fromJson(appearance);
      this.factory.paint(open.window, painted);
      open.appearance = painted;
    }
    catch (error) {
      this.log(Resources.formatAppearanceRejected(String(error)));
    }
    return open;
  }

  public show(open: OpenWindow | null, appearance: unknown): void {
    this.repaint(open, appearance)?.markPainted();
  }
}
