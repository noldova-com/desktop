/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IMainProcessLog } from "@noldova/desktop.electron";

export class FakeMainProcessLog implements IMainProcessLog {
  public readonly lines: string[] = [];
  public readonly flushed: string[][] = [];

  public write(text: string): void {
    this.lines.push(text);
  }

  public flush(): void {
    this.flushed.push([...this.lines]);
  }
}
