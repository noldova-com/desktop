/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { ProcessResult } from "../../src/models/processes/process-result.js";
import type { ProcessRunner } from "../../src/services/processes/process-runner.js";
import { StandInBuilderRunnerFixture } from "./stand-in-builder-runner.fixture.js";

export class SignedMacBuilderRunnerFixture extends StandInBuilderRunnerFixture {
  public static readonly SUBMISSION: string = "sample-submission";

  private readonly application: string;

  public readonly macCommands: string[] = [];
  public readonly timeouts: (number | undefined)[] = [];

  public constructor(runner: ProcessRunner, files: readonly string[], application: string) {
    super(runner, files);
    this.application = application;
  }

  public override async runAsync(command: string, commandArguments: readonly string[], directory: string, environment?: NodeJS.ProcessEnv, _watch?: (text: string) => void,
    timeout?: number): Promise<number | null> {
    this.timeouts.push(timeout);
    const exitCode = await super.runAsync(command, commandArguments, directory, environment);
    await mkdir(path.join(this.application, "Contents", "Frameworks"), { recursive: true });
    await writeFile(path.join(this.application, "Contents", "Info.plist"), "<plist version=\"1.0\"><dict/></plist>\n");
    return exitCode;
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv):
    Promise<ProcessResult> {
    this.timeouts.push(timeout);
    const name = path.basename(command);
    switch (name) {
      case "xcrun":
        this.macCommands.push(`${name} ${commandArguments.slice(0, 2).join(" ")}`);
        return commandArguments.includes("submit")
          ? new ProcessResult(0, JSON.stringify({ id: SignedMacBuilderRunnerFixture.SUBMISSION, status: "Accepted" }), String.empty)
          : new ProcessResult(0, "The staple and validate action worked!\n", String.empty);
      case "codesign":
        this.macCommands.push(`${name} ${commandArguments[0] ?? String.empty}`);
        return commandArguments.includes("--display")
          ? new ProcessResult(0, String.empty, "Authority=Developer ID Application: Sample (SAMPLE1234)\n")
          : new ProcessResult(0, String.empty, "valid on disk\n");
      case "spctl":
        this.macCommands.push(name);
        return new ProcessResult(0, String.empty, "accepted\nsource=Notarized Developer ID\n");
      case "hdiutil":
        this.macCommands.push(`${name} ${commandArguments[0] ?? String.empty}`);
        return new ProcessResult(0, String.empty, String.empty);
      case "ditto":
        this.macCommands.push(name);
        await cp(this.application, path.join(commandArguments.at(-1) ?? directory, path.basename(this.application)), { recursive: true });
        return new ProcessResult(0, String.empty, String.empty);
      default:
        return super.captureAsync(command, commandArguments, directory, timeout, environment);
    }
  }
}
