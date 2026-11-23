/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Tab } from "./tab.js";
import type { TabGroup } from "./tab-group.js";

export class ViewFront {
  public readonly groupId: number;
  public readonly earlier: Tab;
  private readonly keys: readonly string[];

  public constructor(group: TabGroup, earlier: Tab) {
    this.groupId = group.id;
    this.earlier = earlier;
    this.keys = ViewFront.keysOf(group);
  }

  public holds(group: TabGroup | null): boolean {
    const keys = Object.isNull(group) ? [] : ViewFront.keysOf(group);
    return keys.length === this.keys.length && keys.every((t, i) => t === this.keys[i]);
  }

  private static keysOf(group: TabGroup): readonly string[] {
    return [...group.tabs.map(t => t.key), ...group.recent.map(t => t.key)];
  }
}
