/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Writable } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { RuntimeMountCheck } from "../../../src/services/packaging/runtime-mount-check.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";

class ScriptedRunner extends ProcessRunner {
  public asked: number = 0;

  private readonly answers: boolean[];

  public constructor(answers: readonly boolean[]) {
    super();
    this.answers = [...answers];
  }

  public override isRunning(): boolean {
    this.asked++;
    return this.answers.length > 1 ? Boolean(this.answers.shift()) : Boolean(this.answers[0]);
  }
}

class RecordedOutput extends Writable {
  public text: string = String.empty;

  public override _write(chunk: unknown, _encoding: BufferEncoding, done: (error?: Error | null) => void): void {
    this.text += String(chunk);
    done();
  }
}

@TestClass
export class RuntimeMountCheckTests {
  private static readonly MOUNT: string = "/tmp/.mount_app-1";
  private static readonly RUNTIME: number = 4_120;

  @TestMethod
  public async saysTheMountOutlivedTheMainProcessWhileTheRuntimeRunsWithIt(): Promise<void> {
    const output = new RecordedOutput();
    const reads: string[] = [];

    await RuntimeMountCheckTests.create(new ScriptedRunner([true]), ["/other", RuntimeMountCheckTests.MOUNT], RuntimeMountCheckTests.RUNTIME, output, reads).requireOutlivesAsync(RuntimeMountCheckTests.MOUNT, RuntimeMountCheckTests.RUNTIME, "quit");

    Assert.areEqual("The runtime's mount of the AppImage outlived the main process, which quit.\n", output.text);
    Assert.areEqual("mounts", reads.join(","));
  }

  @TestMethod
  public async checksNothingOnceTheRuntimeHasExited(): Promise<void> {
    const output = new RecordedOutput();
    const reads: string[] = [];

    await RuntimeMountCheckTests.create(new ScriptedRunner([false]), [], null, output, reads).requireOutlivesAsync(RuntimeMountCheckTests.MOUNT, RuntimeMountCheckTests.RUNTIME, "quit");

    Assert.areEqual(String.empty, output.text + reads.join(","));
  }

  @TestMethod
  public async passesAMountThatEndedAfterTheRuntimeWithdrewItsDiscoveryFileToStop(): Promise<void> {
    const runner = new ScriptedRunner([true]);
    const output = new RecordedOutput();
    const reads: string[] = [];

    await RuntimeMountCheckTests.create(runner, ["/other"], null, output, reads).requireOutlivesAsync(RuntimeMountCheckTests.MOUNT, RuntimeMountCheckTests.RUNTIME, "quit");

    Assert.areEqual("The runtime's mount of the AppImage ended after the runtime, process 4120, withdrew its discovery file to stop once the main process quit.\n", output.text);
    Assert.areEqual("mounts,discovery", reads.join(","));
    Assert.areEqual(1, runner.asked);
  }

  @TestMethod
  public async failsAMountThatEndedWhileTheRuntimeStillRanEvenIfTheRuntimeStopsLater(): Promise<void> {
    const runner = new ScriptedRunner([true, false]);
    const output = new RecordedOutput();

    const failure = await Assert.throwsAsync(
      () => RuntimeMountCheckTests.create(runner, [], RuntimeMountCheckTests.RUNTIME, output).requireOutlivesAsync(RuntimeMountCheckTests.MOUNT, RuntimeMountCheckTests.RUNTIME, "quit"),
      BuildException);

    Assert.areEqual(
      `The runtime's mount of the AppImage at ${RuntimeMountCheckTests.MOUNT} ended once the main process quit, while the runtime, process 4120, still ran and still named itself in its discovery file.`,
      failure.message);
    Assert.areEqual(String.empty, output.text);
    Assert.areEqual(1, runner.asked);
  }

  @TestMethod
  public async failsAtOnceAMountThatEndedWhenTheMainProcessWasKilled(): Promise<void> {
    const output = new RecordedOutput();

    const failure = await Assert.throwsAsync(
      () => RuntimeMountCheckTests.create(new ScriptedRunner([true]), [], RuntimeMountCheckTests.RUNTIME, output).requireOutlivesAsync(RuntimeMountCheckTests.MOUNT, RuntimeMountCheckTests.RUNTIME, "was killed"),
      BuildException);

    Assert.areEqual(
      `The runtime's mount of the AppImage at ${RuntimeMountCheckTests.MOUNT} ended once the main process was killed, while the runtime, process 4120, still ran and still named itself in its discovery file.`,
      failure.message);
    Assert.areEqual(String.empty, output.text);
  }

  private static create(runner: ProcessRunner, mounts: readonly string[], published: number | null, output: Writable, reads: string[] = []): RuntimeMountCheck {
    return new RuntimeMountCheck(runner, async () => {
      reads.push("mounts");
      return mounts;
    }, async () => {
      reads.push("discovery");
      return published;
    }, output);
  }
}
