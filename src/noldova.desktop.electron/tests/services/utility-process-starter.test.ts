/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { DetachedStartReply, DetachedStartRequest, RuntimeStarterEndedException, RuntimeStarterFailedException, UtilityProcessStarter } from "@noldova/desktop.electron";
import type { IProcessStarter } from "@noldova/desktop.runtime";

import { Condition } from "../fixtures/condition.fixture.js";
import { ElectronMainFixture } from "../fixtures/electron-main.fixture.js";
import { FakeUtilityProcessHost } from "../fixtures/fake-utility-process-host.fixture.js";
import { LinkedUtilityProcessHost } from "../fixtures/linked-utility-process-host.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";

@TestClass
export class UtilityProcessStarterTests {
  @TestMethod
  public asksAUtilityProcessToStartTheProgram(): Promise<void> {
    const host = new FakeUtilityProcessHost();
    const environment = { ELECTRON_RUN_AS_NODE: "1" };

    const starting = new UtilityProcessStarter(host, { PATH: "C:\\Windows" }, "C:\\Users\\person\\work", "C:\\Noldova Desktop Sample\\utility-entry.js").startAsync("C:\\Noldova Desktop Sample\\Noldova Desktop Sample.exe", ["entry.js"], environment, "C:\\data\\start.log");
    const fork = host.forks[0];
    fork?.process.emit("message", DetachedStartReply.started(5120).toJson());

    return starting.then(processId => {
      Assert.areEqual(5120, processId);
      Assert.areEqual("C:\\Noldova Desktop Sample\\utility-entry.js", fork?.modulePath);
      Assert.areEqual(0, fork?.args.length);
      Assert.areEqual("ignore", fork?.options.stdio);
      Assert.areEqual("Noldova Desktop Sample runtime starter", fork?.options.serviceName);
      Assert.areEqual(JSON.stringify({ PATH: "C:\\Windows", ELECTRON_NO_ATTACH_CONSOLE: "1" }), JSON.stringify(fork?.options.env));
      Assert.areEqual("C:\\Users\\person\\work", fork?.options.cwd);
      Assert.areEqual(
        JSON.stringify(new DetachedStartRequest("C:\\Noldova Desktop Sample\\Noldova Desktop Sample.exe", ["entry.js"], "C:\\data\\start.log", environment).toJson()),
        JSON.stringify(fork?.process.messages[0]));
      Assert.areEqual("acknowledged", fork?.process.messages[1]);
    });
  }

  @TestMethod
  public async startsTheUtilityProcessInTheGivenWorkingFolder(): Promise<void> {
    const host = new FakeUtilityProcessHost();

    const starting = new UtilityProcessStarter(host, {}, "C:\\Users\\person\\work").startAsync("C:\\Tools\\tool.exe", [], {}, "C:\\data\\start.log", "C:\\Users\\person\\project");
    host.forks[0]?.process.emit("message", DetachedStartReply.started(5120).toJson());
    await starting;

    Assert.areEqual("C:\\Users\\person\\project", host.forks[0]?.options.cwd);
  }

  @TestMethod
  public async reportsAStartedProgramWhenTheStarterEndsTheMomentItMay(): Promise<void> {
    const programs: string[] = [];
    const program: IProcessStarter = {
      startAsync: executable => {
        programs.push(executable);
        return Promise.resolve(5120);
      }
    };

    const processId = await new UtilityProcessStarter(new LinkedUtilityProcessHost(program), {}, null, "utility-entry.js").startAsync("node", [], {}, "start.log");

    Assert.areEqual(5120, processId);
    Assert.areEqual("node", programs.join(","));
  }

  @TestMethod
  public async reportsAStarterThatFailsOrEnds(): Promise<void> {
    const host = new FakeUtilityProcessHost();
    const starter = new UtilityProcessStarter(host, {}, null, "utility-entry.js");

    const failing = starter.startAsync("node", [], {}, "start.log");
    host.forks[0]?.process.emit("message", DetachedStartReply.failed("LaunchException: The runtime could not be started with node.").toJson());
    const ending = starter.startAsync("node", [], {}, "start.log");
    host.forks[1]?.process.emit("exit", 1);
    const garbled = starter.startAsync("node", [], {}, "start.log");
    host.forks[2]?.process.emit("message", "started");

    Assert.areEqual(
      "The runtime starter could not start the runtime: LaunchException: The runtime could not be started with node.",
      (await Assert.throwsAsync(() => failing, RuntimeStarterFailedException)).message);
    Assert.areEqual("The runtime starter ended before it started the runtime.", (await Assert.throwsAsync(() => ending, RuntimeStarterEndedException)).message);
    await Assert.throwsAsync(() => garbled, JsonException);
    Assert.areEqual("acknowledged,,acknowledged", host.forks.map(t => t.process.messages[1] ?? String.empty).join(","));
    Assert.isFalse(host.forks.some(t => "cwd" in t.options));
  }

  @TestMethod
  public findsItsUtilityEntryBesideThePackage(): void {
    Assert.areEqual("utility-entry.js", path.basename(UtilityProcessStarter.entryPath));
    Assert.isTrue(existsSync(UtilityProcessStarter.entryPath));
  }

  @PlatformFixture.windowsOnly()
  @TestMethod
  public async keepsTheMainProcessesHandlesOutOfTheRuntimeOnWindows(): Promise<void> {
    const root = await mkdtemp(path.join(tmpdir(), "nol-utility-"));
    const mainProcess = ElectronMainFixture.start("utility-start-main.fixture.js", [root]);
    try {
      await mainProcess.ended;
      const runtime = UtilityProcessStarterTests.readProcessId(mainProcess.text, "runtime");

      Assert.isTrue(UtilityProcessStarterTests.isRunning(runtime), "the main process's output ends while the runtime runs");
      Assert.areEqual(0, await mainProcess.exited, mainProcess.text.errors);
      await Condition.waitAsync(() => !UtilityProcessStarterTests.isRunning(UtilityProcessStarterTests.readProcessId(mainProcess.text, "utility")));
      Assert.isTrue(UtilityProcessStarterTests.isRunning(runtime), "the runtime outlives the main process");
      process.kill(runtime);
      await Condition.waitAsync(() => !UtilityProcessStarterTests.isRunning(runtime));
    }
    finally {
      mainProcess.process.kill();
      await rm(`${root}-installation`, { recursive: true, force: true });
      await rm(root, { recursive: true, force: true, maxRetries: 40, retryDelay: 50 });
    }
  }

  @PlatformFixture.windowsOnly()
  @TestMethod
  public async endsAStarterWhoseMainProcessEndedBeforeAcknowledgingOnWindows(): Promise<void> {
    const root = await mkdtemp(path.join(tmpdir(), "nol-utility-"));
    const mainProcess = ElectronMainFixture.start("utility-orphan-main.fixture.js", [root]);
    try {
      await mainProcess.ended;

      Assert.areEqual(0, await mainProcess.exited, mainProcess.text.errors);
      await Condition.waitAsync(() => !UtilityProcessStarterTests.isRunning(UtilityProcessStarterTests.readProcessId(mainProcess.text, "utility")));
    }
    finally {
      mainProcess.process.kill();
      await rm(root, { recursive: true, force: true, maxRetries: 40, retryDelay: 50 });
    }
  }

  private static readProcessId(text: { output: string; errors: string }, name: string): number {
    Assert.isFalse(String.isNullOrWhitespace(text.output), text.errors);
    return JsonReader.parse(text.output.trim()).readInteger(name);
  }

  private static isRunning(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }

}
