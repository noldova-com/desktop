/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DropTarget } from "./drop-target.js";
import type { Layout } from "./layout.js";
import type { Tab } from "./tab.js";

export class TabDropTarget extends DropTarget {
  public readonly groupId: number;
  public readonly index: number;

  public constructor(groupId: number, index: number) {
    super();

    this.groupId = groupId;
    this.index = Math.max(0, Math.round(index));
  }

  public override place(layout: Layout, tab: Tab): Layout {
    return layout.moveTab(tab, this.groupId, this.index);
  }

  public override preview(): null {
    return null;
  }

  public override equals(other: DropTarget | null): boolean {
    return other instanceof TabDropTarget && other.groupId === this.groupId && other.index === this.index;
  }
}
