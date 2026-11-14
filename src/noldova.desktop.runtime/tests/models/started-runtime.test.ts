/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { LaunchSettings, LaunchTimedOutException, RuntimeBuild, RuntimeEntry, RuntimeExitedException, RuntimeExitedWithoutReasonException } from "@noldova/desktop.runtime";

import { StartedRuntime } from "../../src/models/started-runtime.js";
import { ClientListenerFixture } from "../fixtures/client-listener.fixture.js";
import { ErrorCodeFixture } from "../fixtures/error-code.fixture.js";
import { PlatformFixture } from "../fixtures/platform.fixture.js";
import { RuntimeLaunchFixture } from "../fixtures/runtime-launch.fixture.js";
import { ScriptedStarterFixture } from "../fixtures/scripted-starter.fixture.js";
import { UpdateBarrierFixture } from "../fixtures/update-barrier.fixture.js";

@TestClass
export class StartedRuntimeTests {
  @TestMethod
  public async reportsARuntimeThatExitsWhileStarting(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const token = "9f".repeat(32);
    const starter = new ScriptedStarterFixture(
      `console.error("Cannot open " + ${JSON.stringify(path.join(homedir(), "data"))} + " with token ${token}"); process.exit(1);`);

    const exception = await Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, starter).attachAsync("main", new ClientListenerFixture()),
      RuntimeExitedException);

    Assert.areEqual(`The runtime exited while starting: Cannot open ${path.join("~", "data")} with token [redacted]`, exception.message);
    Assert.isFalse(exception.message.includes(token));
    Assert.isFalse(exception.message.includes(homedir()));
    const request = starter.requests[0] ?? [];
    const name = request[request.indexOf("--start-log") + 1];
    Assert.isTrue(/^start-[0-9a-f-]{36}\.log$/.test(String(name)));
    Assert.areEqual(path.join(launch.dataDirectory.logsFolder, String(name)), starter.errorFiles[0]);
    Assert.areEqual(String.empty, (await readdir(launch.dataDirectory.logsFolder)).join(","), "the start log is removed after reading it");
  }

  @TestMethod
  public async reportsARuntimeThatExitsWithoutAReason(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();

    const exception = await Assert.throwsAsync(
      () => UpdateBarrierFixture.createLauncher(launch.createSettings(), RuntimeBuild.identity, new ScriptedStarterFixture("process.exit(1);")).attachAsync("main", new ClientListenerFixture()),
      RuntimeExitedWithoutReasonException);

    Assert.areEqual("The runtime exited while starting and left no reason.", exception.message);
  }

  @TestMethod
  public async removesItsStartLogWhenTheRuntimeNeverStarts(): Promise<void> {
    await using launch = await RuntimeLaunchFixture.createAsync();
    const starter = new ScriptedStarterFixture("setTimeout(() => {}, 500);");
    const settings = new LaunchSettings(launch.dataDirectory, process.execPath, RuntimeEntry.entryPath, {}, process.platform, 1_000, 200);

    const exception = await Assert.throwsAsync(() => UpdateBarrierFixture.createLauncher(settings, RuntimeBuild.identity, starter).attachAsync("main", new ClientListenerFixture()), LaunchTimedOutException);

    Assert.areEqual("The runtime did not start in time.", exception.message);
    Assert.areEqual(String.empty, (await readdir(launch.dataDirectory.logsFolder)).join(","));
    Assert.isTrue(await RuntimeLaunchFixture.waitForExitAsync(Number(starter.processIds[0])));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async isRunningUntilItsProcessEnds(): Promise<void> {
    const child = spawn(process.execPath, ["-e", String.empty], { stdio: "ignore" });
    await once(child, "exit");

    Assert.isTrue(new StartedRuntime(process.pid, "start.log").isRunning);
    Assert.isFalse(new StartedRuntime(Number(child.pid), "start.log").isRunning);
  }

  @TestMethod
  public passesOnAFailureToCheckTheProcessThatIsNotAboutAMissingProcess(): void {
    const failure = Assert.throws(() => new StartedRuntime(1.5, "start.log").isRunning, TypeError);

    Assert.areEqual("ERR_INVALID_ARG_TYPE", ErrorCodeFixture.of(failure));
  }
}
