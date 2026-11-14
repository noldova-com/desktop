/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { AgentControlState } from "@noldova/desktop.protocol";

@TestClass
export class AgentControlStateTests {
  @TestMethod
  public pinsItsWireForm(): void {
    const text = "{\"isStopped\":true,\"isActing\":false}";

    const state = AgentControlState.fromJson({ isStopped: false, isActing: true });

    Assert.areEqual(text, JSON.stringify(new AgentControlState(true, false).toJson()));
    Assert.areEqual("false|true", `${String(state.isStopped)}|${String(state.isActing)}`);
  }

  @TestMethod
  public rejectsAMissingOrWrongFieldAndUnknownFields(): void {
    Assert.areEqual("$.isStopped", Assert.throws(() => AgentControlState.fromJson({ isActing: true }), JsonException).path);
    Assert.areEqual("$.isActing", Assert.throws(() => AgentControlState.fromJson({ isStopped: true, isActing: "yes" }), JsonException).path);
    Assert.areEqual("$.reason", Assert.throws(() => AgentControlState.fromJson({ isStopped: true, isActing: true, reason: "Taken over" }), JsonException).path);
  }
}
