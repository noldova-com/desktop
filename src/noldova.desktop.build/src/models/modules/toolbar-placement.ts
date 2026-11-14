/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class ToolbarPlacement {
  public readonly isShown: boolean;
  public readonly after: string | null;
  public readonly before: string | null;
  public readonly startsRow: boolean;

  public constructor(isShown: boolean, after: string | null, before: string | null, startsRow: boolean) {
    this.isShown = isShown;
    this.after = after;
    this.before = before;
    this.startsRow = startsRow;
  }

  public toJson(): Readonly<Record<string, unknown>> {
    return {
      shown: this.isShown,
      ...Object.isNull(this.after) ? {} : { after: this.after },
      ...Object.isNull(this.before) ? {} : { before: this.before },
      ...this.startsRow ? { newRow: true } : {}
    };
  }
}
