/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class CreatedDeviceFile {
  public readonly folder: string;
  public readonly fileName: string;

  public constructor(folder: string, fileName: string) {
    this.folder = folder;
    this.fileName = fileName;
  }
}
