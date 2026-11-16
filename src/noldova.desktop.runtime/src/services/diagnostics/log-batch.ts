/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class LogBatch {
  private readonly settled: PromiseWithResolvers<void> = Promise.withResolvers<void>();

  public readonly isRollOver: boolean;
  public text: string = String.empty;

  public constructor(isRollOver: boolean) {
    this.isRollOver = isRollOver;
  }

  public get written(): Promise<void> {
    return this.settled.promise;
  }

  public resolve(): void {
    this.settled.resolve();
  }

  public reject(failure: unknown): void {
    this.settled.reject(failure);
  }
}
