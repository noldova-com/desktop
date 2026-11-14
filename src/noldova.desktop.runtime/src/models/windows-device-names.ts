/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";

export class WindowsDeviceNames {
  public static readonly all: readonly string[] = Resources.windowsDeviceNames;

  public static includes(name: string): boolean {
    return WindowsDeviceNames.all.includes(name);
  }
}
