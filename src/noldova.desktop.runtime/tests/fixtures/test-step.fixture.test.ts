/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { subscribe, unsubscribe } from "node:diagnostics_channel";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TestStepFixture } from "./test-step.fixture.js";

@TestClass
export class TestStepFixtureTests {
  @TestMethod
  public async publishesEachStepsStartAndEndAroundItAndReturnsItsResult(): Promise<void> {
    const events: string[] = [];
    const started = (message: unknown): void => {
      events.push(`started ${String(message)}`);
    };
    const ended = (message: unknown): void => {
      events.push(`ended ${String(message)}`);
    };
    subscribe(TestStepFixture.STARTED_CHANNEL, started);
    subscribe(TestStepFixture.ENDED_CHANNEL, ended);
    try {
      const steps = new TestStepFixture();

      const result = await steps.runAsync("copying", () => {
        events.push("copy");
        return Promise.resolve(2);
      });

      Assert.areEqual(2, result);
      Assert.areEqual("started copying|copy|ended copying", events.join("|"));
    }
    finally {
      unsubscribe(TestStepFixture.STARTED_CHANNEL, started);
      unsubscribe(TestStepFixture.ENDED_CHANNEL, ended);
    }
  }

  @TestMethod
  public async publishesTheEndOfAStepThatFailsAndRethrowsItsError(): Promise<void> {
    const events: string[] = [];
    const ended = (message: unknown): void => {
      events.push(`ended ${String(message)}`);
    };
    subscribe(TestStepFixture.ENDED_CHANNEL, ended);
    try {
      const failure = new Error("The copy failed.");

      const thrown = await Assert.throwsAsync(() => new TestStepFixture().runAsync("copying", () => Promise.reject(failure)), Error);

      Assert.areEqual(failure, thrown);
      Assert.areEqual("ended copying", events.join("|"));
    }
    finally {
      unsubscribe(TestStepFixture.ENDED_CHANNEL, ended);
    }
  }
}
