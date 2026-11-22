/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { TabGroup } from "./layout/tab-group.js";
import type { TabTarget } from "./tab-target.js";

export class TabMove {
  public readonly target: TabTarget;
  public readonly group: TabGroup;

  public constructor(target: TabTarget, group: TabGroup) {
    this.target = target;
    this.group = group;
  }
}
