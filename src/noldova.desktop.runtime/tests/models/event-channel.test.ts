/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { EventChannel } from "@noldova/desktop.runtime";

@TestClass
export class EventChannelTests {
  @TestMethod
  public publishesAndWithdrawsThroughItsCallbacks(): void {
    const published: JsonValue[] = [];
    let withdrawals = 0;
    const channel = new EventChannel(t => published.push(t), () => withdrawals++);

    channel.publish({ count: 1 });
    channel[Symbol.dispose]();

    Assert.areEqual("[{\"count\":1}]", JSON.stringify(published));
    Assert.areEqual(1, withdrawals);
  }
}
