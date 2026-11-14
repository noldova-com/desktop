/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateBarrierStatus, UpdateInProgressException } from "@noldova/desktop.runtime";

@TestClass
export class UpdateInProgressExceptionTests {
  @TestMethod
  public saysWhetherAnUpdateIsUnderWayOrMayNotHaveFinished(): void {
    const held = new UpdateInProgressException(UpdateBarrierStatus.Held);
    const unfinished = new UpdateInProgressException(UpdateBarrierStatus.Unfinished);

    Assert.areEqual("Noldova Desktop Sample is installing an update.", held.message);
    Assert.areEqual(UpdateBarrierStatus.Held, held.status);
    Assert.areEqual("An update of Noldova Desktop Sample may still be installing, or it did not finish. Open Noldova Desktop Sample to settle it.", unfinished.message);
    Assert.areEqual(UpdateBarrierStatus.Unfinished, unfinished.status);
    Assert.areEqual("UpdateInProgressException", held.name);
  }
}
