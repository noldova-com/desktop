/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SearchFilter {
  public readonly source: string | null;
  public readonly label: string;
  public readonly count: number | null;
  public readonly isActive: boolean;

  public constructor(source: string | null, label: string, count: number | null, isActive: boolean) {
    this.source = source;
    this.label = label;
    this.count = count;
    this.isActive = isActive;
  }
}
