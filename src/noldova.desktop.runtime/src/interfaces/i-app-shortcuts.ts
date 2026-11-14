/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { AppShortcut, KeyChord } from "@noldova/desktop.protocol";

export interface IAppShortcuts {
  list(): readonly AppShortcut[];

  has(key: KeyChord): boolean;

  onChanged(listener: () => void): () => void;
}
