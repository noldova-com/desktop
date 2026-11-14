/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { UpdateStopResult } from "@noldova/desktop.electron";

@TestClass
export class UpdateStopResultTests {
  @TestMethod
  public saysACancelledStopHandedNothingOff(): void {
    const result = UpdateStopResult.cancelled();

    Assert.isFalse(result.isHandedOff);
    Assert.isFalse(result.isHandoffRecorded);
  }

  @TestMethod
  public saysAHandoffWasMadeAndWhetherTheBarrierRecordsIt(): void {
    const recorded = UpdateStopResult.handedOff(true);
    const unrecorded = UpdateStopResult.handedOff(false);

    Assert.isTrue(recorded.isHandedOff);
    Assert.isTrue(recorded.isHandoffRecorded);
    Assert.isTrue(unrecorded.isHandedOff);
    Assert.isFalse(unrecorded.isHandoffRecorded);
  }
}
