/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { RenameRetryFixture } from "./rename-retry.fixture.js";

@TestClass
export class RenameRetryFixtureTests {
  @TestMethod
  public renamesOnceTheFileIsNoLongerHeld(): void {
    const calls: string[] = [];
    const failures = ["EPERM", "EACCES", "EBUSY", "EPERM"];
    const fixture = new RenameRetryFixture((from, to) => {
      calls.push(`${from}>${to}`);
      const code = failures.shift();
      if (!Object.isUndefined(code))
        throw Object.assign(new Error(`${code}: held`), { code });
    });

    fixture.renameSync("runtime.json.part", "runtime.json");

    Assert.areEqual(Array.from({ length: 5 }, () => "runtime.json.part>runtime.json").join(","), calls.join(","));
  }

  @TestMethod
  public rethrowsTheLastErrorWhenTheFileStaysHeld(): void {
    let attempts = 0;
    const fixture = new RenameRetryFixture(() => {
      attempts++;
      throw Object.assign(new Error(`EPERM: held ${attempts}`), { code: "EPERM" });
    });

    const failure = Assert.throws(() => fixture.renameSync("runtime.json.part", "runtime.json"), Error);

    Assert.areEqual(RenameRetryFixture.ATTEMPTS, attempts);
    Assert.areEqual(`EPERM: held ${RenameRetryFixture.ATTEMPTS}`, failure.message);
  }

  @TestMethod
  public failsAtOnceOnAnyOtherError(): void {
    let attempts = 0;
    const fixture = new RenameRetryFixture(() => {
      attempts++;
      throw Object.assign(new Error("ENOENT: missing"), { code: "ENOENT" });
    });

    Assert.throws(() => fixture.renameSync("runtime.json.part", "runtime.json"), Error);

    Assert.areEqual(1, attempts);
  }
}
