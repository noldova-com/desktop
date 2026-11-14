/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { realpath, writeFile } from "node:fs/promises";
import path from "node:path";

import { ProcessRequest, ProcessStartFailedException, ProgramNotFoundException, ProgramPathRelativeException } from "@noldova/desktop.runtime";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ErrorCodeFixture } from "./error-code.fixture.js";
import { PlatformFixture } from "./platform.fixture.js";
import { ProgramFixture } from "./program.fixture.js";
import { StartedProgramsFixture } from "./started-programs.fixture.js";
import { TemporaryFolderFixture } from "./temporary-folder.fixture.js";

@TestClass
export class StartedProgramsFixtureTests {
  @TestMethod
  public async startsTheProgramInItsFolderWithTheEnvironmentItAsksFor(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const programs = new StartedProgramsFixture();

    const owned = await programs.startProcessAsync(new ProcessRequest(process.execPath, [ProgramFixture.file, ProgramFixture.ENVIRONMENT], folder.path, { NOLDOVA_DESKTOP_NOTES: "on" }));
    const output = JsonReader.parse(await ProgramFixture.readAllAsync(owned));
    const exit = await owned.exited;

    Assert.areEqual(await realpath(folder.path), await realpath(output.readString("folder")));
    Assert.areEqual(JSON.stringify([["NOLDOVA_DESKTOP_NOTES", "on"]]), JSON.stringify(output.readValue("kept")));
    Assert.isTrue(exit.isClean);
    Assert.areEqual(1, programs.children.length);
    Assert.areEqual(0, programs.running.length);
  }

  @TestMethod
  public async findsAProgramByItsNameOnThePath(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const programs = new StartedProgramsFixture();
    const name = path.parse(process.execPath).name;

    const owned = await programs.startProcessAsync(new ProcessRequest(name, [ProgramFixture.file, ProgramFixture.EXIT, "0"], folder.path, { PATH: path.dirname(process.execPath) }));
    const exit = await owned.exited;

    Assert.areEqual(process.execPath.toLowerCase(), owned.program.toLowerCase());
    Assert.isTrue(exit.isClean);
  }

  @TestMethod
  public async refusesARelativeProgramAndAMissingOneAsTheRuntimeDoes(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const programs = new StartedProgramsFixture();
    const missing = path.join(folder.path, "missing");

    const relative = await Assert.throwsAsync(() => programs.startProcessAsync(new ProcessRequest(path.join("tools", "notes"), [], folder.path)), ProgramPathRelativeException);
    const absent = await Assert.throwsAsync(() => programs.startProcessAsync(new ProcessRequest(missing, [], folder.path)), ProgramNotFoundException);

    Assert.areEqual(`${path.join("tools", "notes")} is neither a program's name nor an absolute path.`, relative.message);
    Assert.areEqual(`${missing} was not found, or it is not a program that can be run.`, absent.message);
    Assert.areEqual(0, programs.children.length);
  }

  @TestMethod
  public async reportsAProgramThatCannotStartAndKeepsNone(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const programs = new StartedProgramsFixture();

    const missingFolder = await Assert.throwsAsync(() => programs.startProcessAsync(ProgramFixture.request(path.join(folder.path, "missing"), [ProgramFixture.WAIT])), ProcessStartFailedException);
    const invalidArgument = await Assert.throwsAsync(() => programs.startProcessAsync(ProgramFixture.request(folder.path, ["nul\0"])), ProcessStartFailedException);

    Assert.areEqual(`${process.execPath} could not be started.`, missingFolder.message);
    Assert.areEqual("ENOENT", ErrorCodeFixture.of(missingFolder.cause));
    Assert.areEqual(`${process.execPath} could not be started.`, invalidArgument.message);
    Assert.areEqual("ERR_INVALID_ARG_VALUE", ErrorCodeFixture.of(invalidArgument.cause));
    Assert.areEqual(0, programs.children.length);
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async runsABatchFileThroughTheCommandProcessorOnWindows(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const programs = new StartedProgramsFixture();
    const script = path.join(folder.path, "greet.cmd");
    await writeFile(script, `@"${process.execPath}" "${ProgramFixture.file}" ${ProgramFixture.ARGUMENTS} %*\r\n`);

    const owned = await programs.startProcessAsync(new ProcessRequest(script, ["hello notes", "x&y"], folder.path));
    const output = await ProgramFixture.readAllAsync(owned);

    Assert.areEqual(JSON.stringify(["hello notes", "x&y"]), output);
  }

  @TestMethod
  public async stopsTheProgramWhenItsSignalAborts(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const programs = new StartedProgramsFixture();
    const controller = new AbortController();

    const owned = await programs.startProcessAsync(ProgramFixture.request(folder.path, [ProgramFixture.WAIT], controller.signal));
    const wasRunning = programs.running.length;
    controller.abort();
    const exit = await owned.exited;

    Assert.areEqual(1, wasRunning);
    Assert.isFalse(exit.isClean);
    Assert.areEqual(0, programs.running.length);
  }

  @TestMethod
  public async endsAtOnceAProgramThatIgnoresTheRequestToEnd(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const programs = new StartedProgramsFixture();

    const owned = await programs.startProcessAsync(ProgramFixture.request(folder.path, [ProgramFixture.STUBBORN]));
    const ready = await ProgramFixture.readLineAsync(owned);
    const exit = await owned.stopAsync();

    Assert.areEqual(ProgramFixture.READY, ready);
    Assert.isFalse(exit.isClean);
    Assert.isTrue(owned.hasExited);
    Assert.areEqual(0, programs.running.length);
  }

  @TestMethod
  public async takesABrokenInputPipeWithoutFailingTheTest(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const programs = new StartedProgramsFixture();

    const owned = await programs.startProcessAsync(ProgramFixture.request(folder.path, [ProgramFixture.WAIT]));
    const isHeard = owned.input.emit("error", new Error("write EPIPE"));
    await owned.stopAsync();

    Assert.isTrue(isHeard);
  }

  @TestMethod
  public async takesAWriteAfterTheProgramExitedAsAFailedWrite(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const programs = new StartedProgramsFixture();

    const owned = await programs.startProcessAsync(ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    await owned.exited;
    const failure = await new Promise<Error | null | undefined>(resolve => owned.input.write("late\n", resolve));

    Assert.isTrue(failure instanceof Error);
  }

  @TestMethod
  public async startsNothingForASignalThatAlreadyAborted(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const programs = new StartedProgramsFixture();

    await Assert.throwsAsync(() => programs.startProcessAsync(ProgramFixture.request(folder.path, [ProgramFixture.WAIT], AbortSignal.abort())), DOMException);

    Assert.areEqual(0, programs.children.length);
  }
}
