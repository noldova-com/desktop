/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProductDeviceFolders {
  public readonly windows: string;
  public readonly macos: string;
  public readonly linux: string;

  public constructor(windows: string, macos: string, linux: string) {
    this.windows = windows;
    this.macos = macos;
    this.linux = linux;
  }
}
