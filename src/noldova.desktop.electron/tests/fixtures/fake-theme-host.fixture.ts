/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IThemeHost } from "@noldova/desktop.electron";

import { ListenerRegistry } from "./listener-registry.fixture.js";

export class FakeThemeHost implements IThemeHost {
  private readonly listeners: ListenerRegistry = new ListenerRegistry();

  public shouldUseDarkColors: boolean = true;
  public shouldUseDarkColorsForSystemIntegratedUI: boolean = true;

  public get listenerCount(): number {
    return this.listeners.count("updated");
  }

  public on(event: "updated", listener: () => void): this {
    this.listeners.add(event, listener);
    return this;
  }

  public off(event: "updated", listener: () => void): this {
    this.listeners.remove(event, listener);
    return this;
  }

  public update(isDarkApps: boolean, isDarkSystem: boolean): void {
    this.shouldUseDarkColors = isDarkApps;
    this.shouldUseDarkColorsForSystemIntegratedUI = isDarkSystem;
    this.listeners.emit("updated");
  }
}
