/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { LineProcessFixture } from "./line-process.fixture.js";

export class LineProcessWaitFixture {
  public readonly count: number;
  public readonly started: PromiseWithResolvers<LineProcessFixture>;

  public constructor(count: number, started: PromiseWithResolvers<LineProcessFixture>) {
    this.count = count;
    this.started = started;
  }
}
