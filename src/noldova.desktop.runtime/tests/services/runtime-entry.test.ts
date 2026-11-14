/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { EventEmitter, once } from "node:events";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { PassThrough, Writable } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DiscoveryReader, type IPosixProcessAddon, NativeAddon, OwnershipLock, PosixResponsibilityApi, RuntimeEntry } from "@noldova/desktop.runtime";

import { AddonModuleFixture } from "../fixtures/addon-module.fixture.js";
import { CoverageEnvironmentFixture } from "../fixtures/coverage-environment.fixture.js";
import { RuntimeHostFixture } from "../fixtures/runtime-host.fixture.js";
import { TemporaryFolderFixture } from "../fixtures/temporary-folder.fixture.js";
import { UpdateBarrierFixture } from "../fixtures/update-barrier.fixture.js";

@TestClass
export class RuntimeEntryTests {
  private static readonly USAGE: string = "Usage: runtime-entry --data-dir <absolute path> [--idle-grace <milliseconds>] [--start-log <start log name>] [--installation-dir <folder>]";

  @TestMethod
  public explainsItsUsage(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (_fixture, signals, error) => {
      const code = await RuntimeEntry.runAsync(["--idle-grace", "5"], process.platform, process.env, signals, error);

      Assert.areEqual(2, code);
      Assert.areEqual(`ArgumentException: The --data-dir argument is required. (Parameter 'arguments')\n${RuntimeEntryTests.USAGE}\n`, RuntimeEntryTests.read(error));
    });
  }

  @TestMethod
  public endsQuietlyWhenAnotherRuntimeOwnsTheDirectory(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      using lock = OwnershipLock.acquire(fixture.dataDirectory);

      const code = await RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root], process.platform, process.env, signals, error);

      Assert.areEqual(3, code);
      Assert.areEqual(String.empty, RuntimeEntryTests.read(error));
      Assert.isTrue(lock.isHeld);
    });
  }

  @TestMethod
  public reportsAFailureToStart(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      await mkdir(fixture.root, { recursive: true });
      await writeFile(fixture.dataDirectory.root, "not a folder");

      const code = await RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root], process.platform, process.env, signals, error);

      Assert.areEqual(1, code);
      Assert.isTrue(RuntimeEntryTests.read(error).startsWith("Error: "));
    });
  }

  @TestMethod
  public exitsWithTheUpdatingCodeWhileAnUpdateHoldsItsInstallation(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      await using folder = await TemporaryFolderFixture.createAsync();
      const installation = UpdateBarrierFixture.open(folder.path);
      await UpdateBarrierFixture.holdAsync(installation);

      const code = await RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root, "--installation-dir", installation.folder], process.platform, process.env, signals, error);

      Assert.areEqual(4, code);
      Assert.isTrue(RuntimeEntryTests.read(error).includes("Noldova Desktop Sample is installing an update.\n"));
      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
      Assert.areEqual(1, (await readdir(installation.recordFolder)).length);
    });
  }

  @TestMethod
  public stopsOnASignal(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      const listening = RuntimeEntryTests.waitForListenerAsync(signals, "uncaughtExceptionMonitor");
      const running = RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root, "--idle-grace", "60000"], process.platform, process.env, signals, error);
      const endedWith = await Promise.race([listening.then(() => null), running]);
      Assert.isNull(endedWith, `the runtime ended before it started: ${RuntimeEntryTests.read(error)}`);
      Assert.isNotNull(await DiscoveryReader.readAsync(fixture.dataDirectory));
      Assert.areEqual("1,1,1", ["SIGTERM", "SIGINT", "SIGHUP"].map(t => signals.listenerCount(t)).join(","));

      signals.emit("SIGTERM");

      Assert.areEqual(0, await running);
      Assert.areEqual("0,0,0", ["SIGTERM", "SIGINT", "SIGHUP"].map(t => signals.listenerCount(t)).join(","));
      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
    });
  }

  @TestMethod
  public stopsOnAHangUpAsOnATerminate(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      const listening = RuntimeEntryTests.waitForListenerAsync(signals, "uncaughtExceptionMonitor");
      const running = RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root, "--idle-grace", "60000"], process.platform, process.env, signals, error);
      await listening;

      signals.emit("SIGHUP");

      Assert.areEqual(0, await running);
      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
    });
  }

  @TestMethod
  public logsOnceWhyItIsNotItsOwnResponsibleProcessAndNothingWhenItIs(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      await using inherited = await AddonModuleFixture.createAsync("{ readResponsibleProcessId: () => 1, readProcessPath: () => null }");
      await using own = await AddonModuleFixture.createAsync(`{ readResponsibleProcessId: () => ${process.pid}, readProcessPath: () => null }`);
      const read = async (addon: AddonModuleFixture): Promise<number> => {
        const listening = RuntimeEntryTests.waitForListenerAsync(signals, "uncaughtExceptionMonitor");
        const running = RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root, "--idle-grace", "60000"], process.platform, process.env, signals, error,
          new PosixResponsibilityApi(new NativeAddon<IPosixProcessAddon>(addon.file, ["readResponsibleProcessId", "readProcessPath"])));
        await listening;
        signals.emit("SIGTERM");
        Assert.areEqual(0, await running);
        return (await readFile(fixture.dataDirectory.runtimeLog, "utf8")).split("This runtime is not its own responsible process").length - 1;
      };

      Assert.areEqual(JSON.stringify([1, 0]), JSON.stringify([await read(inherited), await read(own)]));
    });
  }

  @TestMethod
  public logsAFailureToReadItsResponsibleProcessAndKeepsRunning(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      await using failing = await AddonModuleFixture.createAsync("{ readResponsibleProcessId: () => { throw new Error('The responsibility call failed.'); }, readProcessPath: () => null }");
      const listening = RuntimeEntryTests.waitForListenerAsync(signals, "uncaughtExceptionMonitor");
      const running = RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root, "--idle-grace", "60000"], process.platform, process.env, signals, error,
        new PosixResponsibilityApi(new NativeAddon<IPosixProcessAddon>(failing.file, ["readResponsibleProcessId", "readProcessPath"])));
      await listening;

      signals.emit("SIGTERM");

      Assert.areEqual(0, await running);
      Assert.isTrue((await readFile(fixture.dataDirectory.runtimeLog, "utf8")).includes(" Error: The responsibility call failed.\n    at "));
    });
  }

  @TestMethod
  public keepsRunningWhenItsStandardErrorFailsLater(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      const listening = RuntimeEntryTests.waitForListenerAsync(signals, "uncaughtExceptionMonitor");
      const running = RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root, "--idle-grace", "60000"], process.platform, process.env, signals, error);
      const endedWith = await Promise.race([listening.then(() => null), running]);
      Assert.isNull(endedWith, `the runtime ended before it started: ${RuntimeEntryTests.read(error)}`);

      error.emit("error", Object.assign(new Error("write EPIPE"), { code: "EPIPE" }));
      Assert.throws(() => error.emit("error", new TypeError("A bug in a write.")), TypeError);
      signals.emit("SIGTERM");

      Assert.areEqual(0, await running);
      error.emit("error", Object.assign(new Error("write EPIPE"), { code: "EPIPE" }));
      Assert.isFalse(OwnershipLock.isOwned(fixture.dataDirectory));
    });
  }

  @TestMethod
  public keepsNothingInMemoryWhenWritingItsStandardErrorFails(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals) => {
      let attempts = 0;
      const error = new Writable({
        write: (_chunk, _encoding, done) => {
          attempts++;
          done(Object.assign(new Error("EDQUOT: disk quota exceeded, write"), { code: "EDQUOT" }));
        }
      });
      const listening = RuntimeEntryTests.waitForListenerAsync(signals, "uncaughtExceptionMonitor");
      const running = RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root, "--idle-grace", "60000"], process.platform, process.env, signals, error);
      Assert.isNull(await Promise.race([listening.then(() => null), running]));

      error.write("A module's diagnostic.\n");
      error.write("A module's later diagnostic.\n");
      signals.emit("SIGTERM");

      Assert.areEqual(0, await running);
      Assert.areEqual(1, attempts);
      Assert.areEqual(0, error.writableLength);
    });
  }

  @TestMethod
  public writesAnUncaughtFailureToTheLog(): Promise<void> {
    return RuntimeEntryTests.runAsync(async (fixture, signals, error) => {
      const listening = RuntimeEntryTests.waitForListenerAsync(signals, "uncaughtExceptionMonitor");
      const running = RuntimeEntry.runAsync(["--data-dir", fixture.dataDirectory.root, "--idle-grace", "60000"], process.platform, process.env, signals, error);
      await listening;

      signals.emit("uncaughtExceptionMonitor", new Error("The module notes threw."));
      signals.emit("SIGTERM");

      Assert.areEqual(0, await running);
      Assert.areEqual(0, signals.listenerCount("uncaughtExceptionMonitor"));
      Assert.isTrue((await readFile(fixture.dataDirectory.runtimeLog, "utf8")).includes(" Error: The module notes threw.\n    at "));
    });
  }

  @TestMethod
  public runsAsAProgram(): Promise<void> {
    return RuntimeEntryTests.runAsync(async () => {
      const child = spawn(process.execPath, [RuntimeEntry.entryPath, "--data-dir"], {
        env: CoverageEnvironmentFixture.forChild(process.env),
        stdio: ["ignore", "ignore", "pipe"],
        windowsHide: true
      });
      let output = String.empty;
      child.stderr.setEncoding("utf8").on("data", (chunk: string) => output += chunk);

      const [code] = await once(child, "exit");

      Assert.areEqual(2, code);
      Assert.areEqual(`ArgumentException: The argument --data-dir needs a value. (Parameter 'arguments')\n${RuntimeEntryTests.USAGE}\n`, output.replaceAll("\r\n", "\n"));
    });
  }

  @TestMethod
  public async settlesTheExitCodeARunEndsWith(): Promise<void> {
    const error = new PassThrough({ encoding: "utf8" });
    const exit: Pick<NodeJS.Process, "exitCode"> = { exitCode: undefined };

    await RuntimeEntry.settleAsync(Promise.resolve(3), error, exit);

    Assert.areEqual(3, exit.exitCode);
    Assert.areEqual(String.empty, RuntimeEntryTests.read(error));
  }

  @TestMethod
  public async writesARejectedRunAndExitsWithAFailure(): Promise<void> {
    const error = new PassThrough({ encoding: "utf8" });
    const exit: Pick<NodeJS.Process, "exitCode"> = { exitCode: undefined };

    await RuntimeEntry.settleAsync(Promise.reject(new RangeError("The run broke.")), error, exit);

    Assert.areEqual(1, exit.exitCode);
    Assert.isTrue(RuntimeEntryTests.read(error).startsWith("RangeError: The run broke.\n    at "));
  }

  private static read(stream: PassThrough): string {
    return String(stream.read() ?? String.empty);
  }

  private static waitForListenerAsync(emitter: EventEmitter, event: string): Promise<void> {
    return new Promise<void>(resolve => {
      const added = (name: string | symbol): void => {
        if (name !== event)
          return;
        emitter.off("newListener", added);
        resolve();
      };
      emitter.on("newListener", added);
    });
  }

  private static async runAsync(test: (fixture: RuntimeHostFixture, signals: EventEmitter, error: PassThrough) => Promise<void>): Promise<void> {
    await using fixture = await RuntimeHostFixture.createAsync();
    await test(fixture, new EventEmitter(), new PassThrough({ encoding: "utf8" }));
  }
}
