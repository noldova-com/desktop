/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { StartedProcess } from "../../../src/services/processes/started-process.js";

@TestClass
export class StartedProcessTests {
  private static readonly LIMIT: number = 30_000;

  @TestMethod
  public async namesTheSignalThatEndedTheProcessAndNoExitCode(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "started-process-"));
    try {
      const started = await new ProcessRunner().startAsync(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], folder, path.join(folder, "log.txt"));
      started.signal("SIGTERM");

      const hasExited = await started.waitAsync(StartedProcessTests.LIMIT);

      Assert.isTrue(hasExited);
      Assert.areEqual("SIGTERM", started.signalCode);
      Assert.areEqual(null, started.exitCode);
      Assert.areEqual("ended by SIGTERM", started.ending);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  @TestMethod
  public async answersThatAProcessStillRunsWhenItOutlastsTheWait(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "started-process-"));
    try {
      const started = await new ProcessRunner().startAsync(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], folder, path.join(folder, "log.txt"));

      const hasExited = await started.waitAsync(1);
      const wasRunning = !started.hasExited;
      started.signal("SIGKILL");

      Assert.isFalse(hasExited);
      Assert.isTrue(wasRunning);
      Assert.isTrue(started.id > 0);
      Assert.isTrue(await started.waitAsync(StartedProcessTests.LIMIT));
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  @TestMethod
  public async refusesToNameTheIdOfAProcessThatNeverStarted(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "started-process-"));
    try {
      const child = spawn(path.join(folder, "missing-program"), [], { cwd: folder });
      const failed = once(child, "error");
      const started = new StartedProcess(child);

      const error = Assert.throws(() => started.id, BuildException);
      const [spawnError]: unknown[] = await failed;

      Assert.areEqual("The process has no process ID, because it never started.", error.message);
      Assert.isTrue(spawnError instanceof Error && "code" in spawnError && spawnError.code === "ENOENT", String(spawnError));
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  @TestMethod
  public async namesTheExitCodeOfAProcessThatExitedByItself(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "started-process-"));
    try {
      const started = await new ProcessRunner().startAsync(process.execPath, ["-e", "process.exit(3)"], folder, path.join(folder, "log.txt"));

      const hasExited = await started.waitAsync(StartedProcessTests.LIMIT);

      Assert.isTrue(hasExited);
      Assert.areEqual(null, started.signalCode);
      Assert.areEqual("exited with code 3", started.ending);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  @TestMethod
  public async endsTheWaitForItsExitOnlyOnceTheProcessExits(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "started-process-"));
    try {
      const started = await new ProcessRunner().startAsync(process.execPath, ["-e", "setInterval(() => undefined, 1000)"], folder, path.join(folder, "log.txt"));
      const exit = started.waitForExitAsync();
      const wasRunning = !started.hasExited;
      started.signal("SIGKILL");

      await exit;

      Assert.isTrue(wasRunning);
      Assert.isTrue(started.hasExited);
      Assert.areEqual("SIGKILL", started.signalCode);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }
}
