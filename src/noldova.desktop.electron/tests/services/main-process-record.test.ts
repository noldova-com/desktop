/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import type { UpdateProcess } from "@noldova/desktop.protocol";
import { MainProcessRecord } from "@noldova/desktop.electron";

import { FakeProcessPresence } from "../fixtures/fake-process-presence.fixture.js";

@TestClass
export class MainProcessRecordTests {
  private readonly recorded: UpdateProcess[] = [];

  @TestMethod
  public async recordsTheMainProcessStampedWithItsStart(): Promise<void> {
    const isRecorded = await MainProcessRecord.recordAsync({ recordMainProcessAsync: t => this.recordAsync(t) }, new FakeProcessPresence(), 4120);

    Assert.isTrue(isRecorded);
    Assert.areEqual(JSON.stringify([{ processId: 4120, earliest: 1500, latest: 1501, role: "main" }]), JSON.stringify(this.recorded.map(t => t.toJson())));
  }

  @TestMethod
  public async recordsNothingWhenItsProcessIsNotInTheTable(): Promise<void> {
    const presence = new FakeProcessPresence();
    presence.isStamping = false;

    const isRecorded = await MainProcessRecord.recordAsync({ recordMainProcessAsync: t => this.recordAsync(t) }, presence, 4120);

    Assert.isFalse(isRecorded);
    Assert.areEqual(0, this.recorded.length);
  }

  private recordAsync(mainProcess: UpdateProcess): Promise<void> {
    this.recorded.push(mainProcess);
    return Promise.resolve();
  }
}
