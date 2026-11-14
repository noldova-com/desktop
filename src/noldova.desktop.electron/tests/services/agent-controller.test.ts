/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandRun, Failure, FailureCode, Response } from "@noldova/desktop.protocol";

import { Condition } from "../fixtures/condition.fixture.js";
import { MainProcessStartFixture } from "../fixtures/main-process-start.fixture.js";
import { TrayFixture } from "../fixtures/tray.fixture.js";

@TestClass
export class AgentControllerTests {
  private static readonly NOT_READ: string = "The runtime's agent control could not be read, so the stop key waits for its next change: ";
  private static readonly NOT_RUN: string = "could not run from the stop key or the tray: The runtime is stopping.";

  @TestMethod
  public async readsAgentControlOnceTheRuntimeIsReadyAndShowsItInTheTray(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("desktop.agentControl", Response.success("r", { isStopped: true, isActing: true }));

    await fixture.startAsync();
    await Condition.waitAsync(() => fixture.rows.includes("Resume agents"));

    Assert.areEqual("take Control+Shift+.", fixture.electron.shortcuts.steps.join(","));
    Assert.areEqual(0, MainProcessStartFixture.readErrors(fixture.process, AgentControllerTests.NOT_READ).length);
  }

  @TestMethod
  public async runsTheTraysStopAndResumeAsCommandsAndLogsEachOneTheRuntimeRefuses(): Promise<void> {
    const fixture = new TrayFixture("win32");
    fixture.connection.answers.set("desktop.runCommand", Response.failure("r", new Failure(FailureCode.Unavailable, "The runtime is stopping.")));
    await fixture.startAsync();

    fixture.send("agentControl", { isStopped: false, isActing: true });
    fixture.click("Stop agents");
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(fixture.process, "The command desktop.stopAgentControl").length > 0);
    fixture.send("agentControl", { isStopped: true, isActing: true });
    fixture.click("Resume agents");
    await Condition.waitAsync(() => MainProcessStartFixture.readErrors(fixture.process, "The command desktop.resumeAgentControl").length > 0);

    Assert.areEqual("desktop.stopAgentControl,desktop.resumeAgentControl",
      fixture.connection.payloads.filter((_t, index) => fixture.connection.calls[index] === "desktop.runCommand").map(t => CommandRun.fromJson(t).name.text).join(","));
    Assert.areEqual(JSON.stringify([`The command desktop.stopAgentControl ${AgentControllerTests.NOT_RUN}`, `The command desktop.resumeAgentControl ${AgentControllerTests.NOT_RUN}`]),
      JSON.stringify(MainProcessStartFixture.readErrors(fixture.process, "The command desktop.")));
  }

  @TestMethod
  public async logsAChangeItCannotReadAndKeepsTheStateItHad(): Promise<void> {
    const fixture = new TrayFixture("win32");
    await fixture.startAsync();
    fixture.send("agentControl", { isStopped: true, isActing: true });

    fixture.send("agentControl", { isStopped: "no", isActing: false });

    Assert.areEqual(1, MainProcessStartFixture.readErrors(fixture.process, AgentControllerTests.NOT_READ).length);
    Assert.isTrue(fixture.rows.includes("Resume agents"), fixture.rows.join(","));
    Assert.areEqual("take Control+Shift+.", fixture.electron.shortcuts.steps.join(","));
  }
}
