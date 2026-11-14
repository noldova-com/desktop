/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { QuickInputItem } from "@noldova/ui.components.angular";

export class CommandSearchEntry {
  public readonly item: QuickInputItem;
  public readonly run: () => void;

  public constructor(item: QuickInputItem, run: () => void) {
    this.item = item;
    this.run = run;
  }

  public get detail(): string {
    return this.item.detail ?? String.empty;
  }
}
