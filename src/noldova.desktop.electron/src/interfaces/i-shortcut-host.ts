/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export interface IShortcutHost {
  register(accelerator: string, callback: () => void): boolean;
  unregister(accelerator: string): void;
}
