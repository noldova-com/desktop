/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export interface IProcessTreeRow {
  readonly processId: number;
  readonly parentId: number;
  readonly created: number | null;
}

export class ProcessTree {
  private readonly rows: ReadonlyMap<number, IProcessTreeRow>;

  public constructor(rows: readonly IProcessTreeRow[]) {
    this.rows = new Map(rows.map(t => [t.processId, t]));
  }

  public listDescendants(processId: number): number[] {
    if (!this.rows.has(processId))
      throw new Error(`The process list has no row for process ${processId}, so it failed or the process has ended, and the processes it started are unknown.`);
    const descendants: number[] = [];
    for (let generation = [processId]; generation.length > 0;) {
      const parents = generation;
      generation = [...this.rows.values()]
        .filter(t => parents.includes(t.parentId) && t.processId !== processId && !descendants.includes(t.processId) && this.isStartedByParent(t))
        .map(t => t.processId);
      descendants.push(...generation);
    }
    return descendants;
  }

  private isStartedByParent(row: IProcessTreeRow): boolean {
    const parentCreated = this.rows.get(row.parentId)?.created ?? null;
    return Object.isNull(row.created) || Object.isNull(parentCreated) || row.created >= parentCreated;
  }
}
