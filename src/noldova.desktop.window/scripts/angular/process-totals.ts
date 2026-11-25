/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ProcessTotals {
  private static readonly HANDLES: string = "Handle Count";
  private static readonly BYTES_PER_MEGABYTE: number = 1024 * 1024;

  private count: number = 0;
  private handles: number = 0;
  private workingSet: number = 0;

  public add(counter: string, value: number): void {
    if (counter === ProcessTotals.HANDLES) {
      this.count++;
      this.handles += value;
    }
    else
      this.workingSet += value;
  }

  public describe(name: string): string {
    return `${name} ${this.count} ${this.count === 1 ? "process" : "processes"}, ${this.handles} handles, ${ProcessTotals.megabytes(this.workingSet)} working set`;
  }

  public static megabytes(bytes: number): string {
    return `${(bytes / ProcessTotals.BYTES_PER_MEGABYTE).toFixed(1)} MB`;
  }
}
