/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Tab } from "./layout/tab.js";
import type { TabGroup } from "./layout/tab-group.js";

export class FocusableGroup {
  public readonly group: TabGroup;
  public readonly tab: Tab;

  public constructor(group: TabGroup, tab: Tab) {
    this.group = group;
    this.tab = tab;
  }
}
