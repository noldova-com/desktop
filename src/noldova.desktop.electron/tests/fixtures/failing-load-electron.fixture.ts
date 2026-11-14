/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { BrowserWindowConstructorOptions } from "electron";

import { FailingLoadWindow } from "./failing-load-window.fixture.js";
import { FakeElectron } from "./fake-electron.fixture.js";

export class FailingLoadElectron extends FakeElectron {
  public override createWindow(options: BrowserWindowConstructorOptions): FailingLoadWindow {
    const window = new FailingLoadWindow(options, this.windows.length + 1, this.windowSession);
    this.windows.push(window);
    return window;
  }
}
