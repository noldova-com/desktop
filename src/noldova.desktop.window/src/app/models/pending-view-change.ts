/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PendingViewChange {
  public readonly moduleId: string;
  public readonly isEarly: boolean;
  public readonly opened: string | null;
  public readonly apply: () => void;

  public constructor(moduleId: string, isEarly: boolean, opened: string | null, apply: () => void) {
    this.moduleId = moduleId;
    this.isEarly = isEarly;
    this.opened = opened;
    this.apply = apply;
  }
}
