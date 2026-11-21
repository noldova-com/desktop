/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ShellMethods, WindowStateKey } from "@noldova/desktop.protocol";

import { StartupStateKind } from "../enums/startup-state-kind.js";
import { WindowStateRefusedException } from "../exceptions/window-state-refused.exception.js";
import { WindowStateUnavailableException } from "../exceptions/window-state-unavailable.exception.js";
import type { KnownDevice } from "../models/known-device.js";
import type { WindowState } from "../models/window-state.js";
import { Resources } from "../resources.js";
import type { LocalWindowStateStore } from "./local-window-state-store.js";
import { MirroredWindowStateStore } from "./mirrored-window-state-store.js";
import type { OpenWindow } from "./open-window.js";
import type { RuntimeStartup } from "./runtime-startup.js";
import { RuntimeWindowStateStore } from "./runtime-window-state-store.js";

export class WindowPlacement {
  private readonly store: LocalWindowStateStore;
  private readonly startup: RuntimeStartup;
  private readonly device: KnownDevice;
  private readonly log: (text: string) => void;
  private readonly restored: WeakSet<OpenWindow> = new WeakSet();
  private readonly placed: WeakSet<OpenWindow> = new WeakSet();

  public constructor(store: LocalWindowStateStore, startup: RuntimeStartup, device: KnownDevice, log: (text: string) => void) {
    this.store = store;
    this.startup = startup;
    this.device = device;
    this.log = log;
  }

  public readStateAsync(): Promise<WindowState | null> {
    return this.store.readStateAsync();
  }

  public begin(open: OpenWindow, saved: WindowState): void {
    open.bounds.begin(this.store, saved);
    this.placed.add(open);
  }

  public async prepareAsync(open: OpenWindow): Promise<void> {
    const kind = this.startup.current.kind;
    if (kind === StartupStateKind.Connecting)
      return;
    if (kind === StartupStateKind.Ready && this.restored.has(open))
      await open.bounds.saveUnsavedAsync().catch((error: unknown) => this.logUnsaved(error));
    else if (kind === StartupStateKind.Ready) {
      this.restored.add(open);
      const device = await this.device.readAsync();
      if (!Object.isNull(device) && this.placed.has(open))
        await open.bounds.followAsync(this.createStore(device)).catch((error: unknown) => this.logUnsaved(error));
      else if (!Object.isNull(device))
        await open.bounds.restoreAsync(this.createStore(device)).catch((error: unknown) => {
          if (error instanceof WindowStateUnavailableException || error instanceof WindowStateRefusedException)
            this.restored.delete(open);
          if (!(error instanceof WindowStateUnavailableException))
            this.log(Resources.formatBoundsNotRestored(String(error)));
        });
    }
    open.settle();
  }

  public async holdAsync(open: OpenWindow): Promise<void> {
    await open.bounds.holdAsync().catch((error: unknown) => this.logUnsaved(error));
    if (this.startup.current.kind === StartupStateKind.Ready)
      await open.bounds.saveUnsavedAsync().catch((error: unknown) => this.logUnsaved(error));
  }

  private createStore(device: string): MirroredWindowStateStore {
    return new MirroredWindowStateStore(
      new RuntimeWindowStateStore(() => this.startup.connection, new WindowStateKey(device, Resources.mainWindow), ShellMethods.readWindowBounds, ShellMethods.writeWindowBounds),
      this.store);
  }

  private logUnsaved(error: unknown): void {
    if (!(error instanceof WindowStateUnavailableException))
      this.log(Resources.formatBoundsUnsaved(String(error)));
  }
}
