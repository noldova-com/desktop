/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { FileHolders } from "../../../src/services/packaging/file-holders.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";

class HoldersRunner extends ProcessRunner {
  private readonly result: ProcessResult;

  public command: string = String.empty;
  public files: string | undefined = undefined;
  public script: string = String.empty;

  public constructor(result: ProcessResult) {
    super();
    this.result = result;
  }

  public override captureAsync(...call: Parameters<ProcessRunner["captureAsync"]>): Promise<ProcessResult> {
    const [command, commandArguments, , , environment] = call;
    this.command = command;
    this.files = environment?.["NOLDOVA_DESKTOP_LEFT_FILES"];
    this.script = Buffer.from(commandArguments.at(-1) ?? String.empty, "base64").toString("utf16le");
    return Promise.resolve(this.result);
  }
}

@TestClass
export class FileHoldersTests {
  @TestMethod
  public async describesWhatHoldsTheFilesItIsGiven(): Promise<void> {
    const runner = new HoldersRunner(new ProcessResult(0, "  Sample.exe (1234) holds C:\\app\\Sample.exe\n", String.empty));

    const description = await new FileHolders(runner, "C:\\work", { PATH: "C:\\Windows" }).describeAsync(["C:\\app\\Sample.exe", "C:\\app\\resources\\app.asar"]);

    Assert.areEqual("What holds them now:\nSample.exe (1234) holds C:\\app\\Sample.exe", description);
    Assert.areEqual("powershell.exe", runner.command);
    Assert.areEqual("C:\\app\\Sample.exe\nC:\\app\\resources\\app.asar", runner.files);
    Assert.isTrue(runner.script.includes("Add-Type"), runner.script);
  }

  @TestMethod
  public async saysWhenWhatHoldsTheFilesCannotBeRead(): Promise<void> {
    const runner = new HoldersRunner(new ProcessResult(1, String.empty, "Access is denied.\n"));

    const description = await new FileHolders(runner, "C:\\work", {}).describeAsync(["C:\\app\\Sample.exe"]);

    Assert.areEqual("What holds them could not be read: powershell.exe exited with 1:\nAccess is denied.", description);
  }
}
