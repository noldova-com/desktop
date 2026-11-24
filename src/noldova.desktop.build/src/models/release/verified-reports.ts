/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PackageTarget } from "../packaging/package-target.ts";

export class VerifiedReports {
  public readonly text: string;
  public readonly unstarted: readonly PackageTarget[];
  public readonly sourcePages: readonly string[];

  public constructor(text: string, unstarted: readonly PackageTarget[], sourcePages: readonly string[]) {
    this.text = text;
    this.unstarted = unstarted;
    this.sourcePages = sourcePages;
  }
}
