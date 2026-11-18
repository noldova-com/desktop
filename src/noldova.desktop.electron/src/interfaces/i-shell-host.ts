/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IShellHost {
  openPath(path: string): Promise<string>;

  openExternal(url: string): Promise<void>;

  showItemInFolder(fullPath: string): void;

  trashItem(path: string): Promise<void>;
}
