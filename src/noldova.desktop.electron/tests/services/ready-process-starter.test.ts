/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ReadyProcessStarter } from "../../src/services/ready-process-starter.js";
import { ListedStarterFixture } from "../fixtures/listed-starter.fixture.js";

@TestClass
export class ReadyProcessStarterTests {
  @TestMethod
  public async startsTheProgramOnlyOnceTheAppIsReady(): Promise<void> {
    const starter = new ListedStarterFixture(5120);
    const ready = Promise.withResolvers<void>();

    const starting = new ReadyProcessStarter(starter, () => ready.promise).startAsync("C:\\App\\App.exe", ["entry.js"], { PATH: "C:\\Windows" }, "C:\\data\\start.log", "C:\\work");
    await Promise.resolve();
    const beforeReady = starter.starts.length;
    ready.resolve();

    Assert.areEqual(5120, await starting);
    Assert.areEqual(0, beforeReady);
    Assert.areEqual(JSON.stringify([JSON.stringify(["C:\\App\\App.exe", ["entry.js"], { PATH: "C:\\Windows" }, "C:\\data\\start.log", "C:\\work"])]), JSON.stringify(starter.starts));
  }

  @TestMethod
  public async startsNothingWhenTheAppNeverGetsReady(): Promise<void> {
    const starter = new ListedStarterFixture(5120);
    const failure = new Error("The app quit before it was ready.");

    const error = await Assert.throwsAsync(() => new ReadyProcessStarter(starter, () => Promise.reject(failure)).startAsync("C:\\App\\App.exe", [], {}, "C:\\data\\start.log"), Error);

    Assert.areEqual(failure, error);
    Assert.areEqual(0, starter.starts.length);
  }
}
