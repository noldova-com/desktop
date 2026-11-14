/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ILineProcessListener } from "../../src/interfaces/i-line-process-listener.js";

export class LineRecorderFixture implements ILineProcessListener {
  private readonly exited: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public readonly lines: string[] = [];
  public readonly exits: string[] = [];

  public onLine(line: string): void {
    this.lines.push(line);
  }

  public onExit(reason: string): void {
    this.exits.push(reason);
    this.exited.resolve();
  }

  public exitedAsync(): Promise<void> {
    return this.exited.promise;
  }
}
