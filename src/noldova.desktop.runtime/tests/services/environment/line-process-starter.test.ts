/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { LineProcessStarter } from "../../../src/services/environment/line-process-starter.js";
import { LineRecorderFixture } from "../../fixtures/line-recorder.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class LineProcessStarterTests {
  private static readonly NAME: string = path.basename(process.execPath);
  private static readonly ENVIRONMENT: Readonly<Record<string, string>> =
    Object.fromEntries(Object.entries(process.env).filter((t): t is [string, string] => !Object.isUndefined(t[1])));

  @TestMethod
  public async startsALineProcessForTheReaders(): Promise<void> {
    const recorder = new LineRecorderFixture();
    const child = new LineProcessStarter(new TextOutputFixture()).start(process.execPath, [ProgramFixture.file, ProgramFixture.ECHO], LineProcessStarterTests.ENVIRONMENT, recorder);

    child.write("started");
    const isAnswered = await WaitFixture.untilAsync(() => recorder.lines.includes("STARTED"), ProgramFixture.LAUNCH_MILLISECONDS);
    child.kill();
    await recorder.exitedAsync();

    Assert.isTrue(isAnswered);
    Assert.areEqual(`${ProgramFixture.READY},STARTED`, recorder.lines.join(","));
  }

  @TestMethod
  public async startsAGroupWithoutInputAndEndsItsLeaderEvenWhenItIgnoresTheGentleSignals(): Promise<void> {
    const recorder = new LineRecorderFixture();
    const child = new LineProcessStarter(new TextOutputFixture()).startGroup(process.execPath, [ProgramFixture.file, ProgramFixture.DEAF], LineProcessStarterTests.ENVIRONMENT, recorder);

    const isReady = await WaitFixture.untilAsync(() => recorder.lines.includes(ProgramFixture.READY), ProgramFixture.LAUNCH_MILLISECONDS);
    child.write("unread");
    child.kill();
    await recorder.exitedAsync();

    Assert.isTrue(isReady);
    Assert.areEqual(`${LineProcessStarterTests.NAME} exited with SIGKILL.`, recorder.exits.join(","));
  }
}
