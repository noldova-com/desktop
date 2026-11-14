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

import type { ILineProcess } from "../../../src/interfaces/i-line-process.js";
import { LineProcess } from "../../../src/services/environment/line-process.js";
import { LineRecorderFixture } from "../../fixtures/line-recorder.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class LineProcessTests {
  private static readonly NAME: string = path.basename(process.execPath);
  private static readonly POSIX_SHELL: string = "/bin/sh";
  private static readonly ENVIRONMENT: Readonly<Record<string, string>> =
    Object.fromEntries(Object.entries(process.env).filter((t): t is [string, string] => !Object.isUndefined(t[1])));

  @TestMethod
  public async givesEachLineWithoutItsCarriageReturnAndSaysAKilledProgramEndedBySignal(): Promise<void> {
    const recorder = new LineRecorderFixture();
    const child = LineProcessTests.start(recorder, ProgramFixture.ECHO);

    child.write("first");
    child.write("second\r");
    const isAnswered = await WaitFixture.untilAsync(() => recorder.lines.includes("SECOND"), ProgramFixture.LAUNCH_MILLISECONDS);
    child.kill();
    await recorder.exitedAsync();

    Assert.isTrue(isAnswered);
    Assert.areEqual(`${ProgramFixture.READY},FIRST,SECOND`, recorder.lines.join(","));
    Assert.areEqual(`${LineProcessTests.NAME} exited with SIGKILL.`, recorder.exits.join(","));
  }

  @TestMethod
  public async saysAProgramThatEndsByItselfEndedWithItsCode(): Promise<void> {
    const recorder = new LineRecorderFixture();
    LineProcessTests.start(recorder, ProgramFixture.EXIT, "3");

    await recorder.exitedAsync();

    Assert.areEqual(`${LineProcessTests.NAME} exited with 3.`, recorder.exits.at(-1));
  }

  @TestMethod
  public async saysWhyAProgramThatCannotStartEnded(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const recorder = new LineRecorderFixture();
    const missing = new LineProcess(path.join(folder.path, "missing"), [], LineProcessTests.ENVIRONMENT, recorder, new TextOutputFixture());

    await recorder.exitedAsync();
    missing.kill();

    Assert.isTrue(recorder.exits[0]?.includes("ENOENT") ?? false);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async saysWhyALineCannotReachAProgramThatClosedItsInput(): Promise<void> {
    const recorder = new LineRecorderFixture();
    const child = new LineProcess(LineProcessTests.POSIX_SHELL, ["-c", "exec 0<&-; echo ready; exec sleep 30"], LineProcessTests.ENVIRONMENT, recorder, new TextOutputFixture());

    const isReady = await WaitFixture.untilAsync(() => recorder.lines.includes("ready"), ProgramFixture.LAUNCH_MILLISECONDS);
    child.write("unread");
    await recorder.exitedAsync();
    const reason = recorder.exits[0] ?? String.empty;
    child.kill();
    const isEnded = await WaitFixture.untilAsync(() => recorder.exits.some(t => t.endsWith("SIGKILL.")), ProgramFixture.END_MILLISECONDS);

    Assert.isTrue(isReady);
    Assert.isTrue(reason.includes("EPIPE"), reason);
    Assert.isTrue(isEnded);
  }

  @TestMethod
  public async endsAProgramWhoseLineGrowsPastTheLimit(): Promise<void> {
    const recorder = new LineRecorderFixture();
    LineProcessTests.start(recorder, ProgramFixture.LONG_LINE);

    await recorder.exitedAsync();

    Assert.areEqual(0, recorder.lines.length);
    Assert.areEqual(`${LineProcessTests.NAME} exited with SIGKILL.`, recorder.exits.at(-1));
  }

  @TestMethod
  public async saysOnALaterTurnWhyAProgramThatSpawnRefusesCannotStart(): Promise<void> {
    const recorder = new LineRecorderFixture();
    const refused = new LineProcess(process.execPath, ["null\0byte"], LineProcessTests.ENVIRONMENT, recorder, new TextOutputFixture());

    const exitsAtOnce = recorder.exits.length;
    refused.write("unread");
    refused.kill();
    await recorder.exitedAsync();

    Assert.areEqual(0, exitsAtOnce);
    Assert.isTrue(recorder.exits[0]?.includes("ERR_INVALID_ARG_VALUE") ?? false, recorder.exits[0]);
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async endsWhatTheGroupStartedEvenAfterItsLeaderEnded(): Promise<void> {
    const recorder = new LineRecorderFixture();
    const child = new LineProcess(process.execPath, [ProgramFixture.file, ProgramFixture.PARENT, "0"], LineProcessTests.ENVIRONMENT, recorder, new TextOutputFixture(), true);

    await recorder.exitedAsync();
    const started = Number(recorder.lines[0]);
    const wasRunning = ProgramFixture.isRunning(started);
    child.kill();
    const isEnded = await ProgramFixture.waitForEndAsync(started, ProgramFixture.END_MILLISECONDS);
    ProgramFixture.endIfRunning(started);

    Assert.isTrue(wasRunning);
    Assert.isTrue(isEnded);
  }

  @TestMethod
  public async saysWhyItsGroupCouldNotBeEndedAndStillEndsTheProgram(): Promise<void> {
    const recorder = new LineRecorderFixture();
    const diagnostics = new TextOutputFixture();
    const signalled: number[] = [];
    const child = new LineProcess(process.execPath, [ProgramFixture.file, ProgramFixture.DEAF], LineProcessTests.ENVIRONMENT, recorder, diagnostics, true, t => {
      signalled.push(t);
      throw Object.assign(new Error("kill EPERM"), { code: "EPERM" });
    });

    const isReady = await WaitFixture.untilAsync(() => recorder.lines.includes(ProgramFixture.READY), ProgramFixture.LAUNCH_MILLISECONDS);
    child.kill();
    await recorder.exitedAsync();

    Assert.isTrue(isReady);
    Assert.areEqual(1, signalled.length);
    Assert.isTrue((signalled[0] ?? 0) < 0);
    Assert.areEqual(`${LineProcessTests.NAME} exited with SIGKILL.`, recorder.exits.join(","));
    Assert.areEqual(`What ${LineProcessTests.NAME} started may outlive it, since its process group could not be ended: Error: kill EPERM\n`, diagnostics.text);
  }

  @TestMethod
  public async passesOverAGroupThatCannotStart(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const recorder = new LineRecorderFixture();
    const missing = new LineProcess(path.join(folder.path, "missing"), [], LineProcessTests.ENVIRONMENT, recorder, new TextOutputFixture(), true);

    await recorder.exitedAsync();
    missing.kill();

    Assert.isTrue(recorder.exits[0]?.includes("ENOENT") ?? false);
  }

  private static start(recorder: LineRecorderFixture, mode: string, ...launchArguments: string[]): ILineProcess {
    return new LineProcess(process.execPath, [ProgramFixture.file, mode, ...launchArguments], LineProcessTests.ENVIRONMENT, recorder, new TextOutputFixture());
  }
}
