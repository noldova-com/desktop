/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import {
  BatchArgumentRefusedException,
  BatchSystemRootMissingException,
  ProcessRequest,
  type ProcessStartException,
  ProcessStartFailedException
} from "@noldova/desktop.runtime";

import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class BatchCommandLineTests {
  @TestMethod
  public async runsABatchFileThroughCmdWithEachArgumentEscapedTwice(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "run (1).cmd");
    await writeFile(file, String.empty);
    const systemRoot = path.join(folder.path, "missing");
    const processes = ProcessSupervisorFixture.create(settings, "win32", { SystemRoot: systemRoot });

    const exception = await Assert.throwsAsync(
      () => processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest(file, ["a b", "x&y", "back\\", String.empty], folder.path)),
      ProcessStartFailedException);

    const cause = JsonReader.parse(JSON.stringify(exception.cause));
    const spawnArguments = cause.readStringArray("spawnargs");
    const line = spawnArguments[3];
    Assert.areEqual(`${file} could not be started.`, exception.message);
    Assert.areEqual(path.win32.join(systemRoot, "System32", "cmd.exe"), cause.readString("path"));
    Assert.areEqual("/d /s /c", spawnArguments.slice(0, 3).join(" "));
    Assert.areEqual(4, spawnArguments.length);
    Assert.isTrue(line?.startsWith("\"") === true, line);
    Assert.isTrue(line?.endsWith("run^ ^(1^).cmd ^^^\"a^^^ b^^^\" ^^^\"x^^^&y^^^\" ^^^\"back\\\\^^^\" ^^^\"^^^\"\"") === true, line);
  }

  @TestMethod
  public async refusesABatchArgumentCmdCannotCarryAndABatchFileWithoutSystemRoot(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const file = path.join(folder.path, "run.bat");
    await writeFile(file, String.empty);
    const startAsync = async (
      environment: NodeJS.ProcessEnv,
      launchArguments: readonly string[],
      exceptionType: new (...arguments_: never[]) => ProcessStartException): Promise<string> => {
      const processes = ProcessSupervisorFixture.create(settings, "win32", environment);
      return (await Assert.throwsAsync(() => processes.startAsync(ProcessSupervisorFixture.MODULE, new ProcessRequest(file, launchArguments, folder.path)), exceptionType)).message;
    };

    Assert.areEqual(
      `${file} is a batch file whose program could not be traced, and cmd.exe cannot be given an argument that holds %, ", !, a line break or a NUL character.`,
      await startAsync({ SystemRoot: folder.path }, ["one", "100%"], BatchArgumentRefusedException));
    Assert.areEqual("SystemRoot is not set, so the Windows system tools cannot be found.", await startAsync({ SystemRoot: " " }, [], BatchSystemRootMissingException));
  }
}
