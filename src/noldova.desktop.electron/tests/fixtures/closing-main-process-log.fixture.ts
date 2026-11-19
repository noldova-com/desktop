/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { FakeMainProcessLog } from "./fake-main-process-log.fixture.js";

export class ClosingMainProcessLog extends FakeMainProcessLog {
  public readonly closing: PromiseWithResolvers<void> = Promise.withResolvers<void>();
  public readonly flushedAtClose: number[] = [];

  public closeAsync(): Promise<void> {
    this.flushedAtClose.push(this.flushed.length);
    return this.closing.promise;
  }
}
