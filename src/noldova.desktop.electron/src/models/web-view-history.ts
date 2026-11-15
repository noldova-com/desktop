/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { NavigationEntry } from "electron";

export class WebViewHistory {
  public readonly entries: readonly NavigationEntry[];
  public readonly index: number;

  public constructor(entries: readonly NavigationEntry[], index: number) {
    this.entries = [...entries];
    this.index = index;
  }

  public get currentUrl(): string | null {
    return this.entries[this.index]?.url ?? null;
  }
}
