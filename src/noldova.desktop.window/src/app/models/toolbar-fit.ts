/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";

export class ToolbarFit {
  public static count(edges: readonly number[], overflowSpace: number, available: number): number {
    const limit = available + Resources.toolbarFitTolerance;
    if ((edges.at(-1) ?? 0) <= limit)
      return edges.length;
    return Math.max(0, edges.findIndex(t => t + overflowSpace > limit));
  }
}
