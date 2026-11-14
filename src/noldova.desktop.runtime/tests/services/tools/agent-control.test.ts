/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandRun, QualifiedName, Request, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class AgentControlTests {
  private static readonly STOP: string = "{\"name\":\"desktop.stopAgentControl\",\"title\":\"Stop agents\",\"icon\":\"stop_circle\",\"defaultKey\":\"Mod+Shift+Period\"";
  private static readonly RESUME: string = "{\"name\":\"desktop.resumeAgentControl\",\"title\":\"Resume agents\",\"icon\":\"play_circle\"";

  @TestMethod
  public stopsAndResumesThroughItsCommandsAndReportsEachChange(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();
      const [connection] = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      const idle = await RuntimeHostFixture.callAsync(connection, "main:1", ShellMethods.agentControl, null);
      const listed = await RuntimeHostFixture.callAsync(connection, "main:2", ShellMethods.commands, null);
      const session = host.modules.tools.openSession("conversation-1", {});
      const acting = await connection.readEventAsync();
      connection.sendMessages(new Request("main:3", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("desktop.stopAgentControl"), null).toJson()));
      const stopping = [await connection.readEventAsync(), await connection.readEventAsync(), await connection.readEventAsync()];
      const stopped = await connection.readResponseAsync();
      const refused = await session.callAsync("notes_search", {});
      connection.sendMessages(new Request("main:4", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("desktop.resumeAgentControl"), null).toJson()));
      const resuming = [await connection.readEventAsync(), await connection.readEventAsync(), await connection.readEventAsync()];
      const resumed = await connection.readResponseAsync();
      const current = await RuntimeHostFixture.callAsync(connection, "main:5", ShellMethods.agentControl, null);
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual("{\"isStopped\":false,\"isActing\":false}", JSON.stringify(idle.payload));
      Assert.isTrue(JSON.stringify(listed.payload).startsWith(`{"commands":[${AgentControlTests.STOP}},${AgentControlTests.RESUME},"isEnabled":false}`), JSON.stringify(listed.payload));
      Assert.areEqual("desktop.agentControlChanged {\"isStopped\":false,\"isActing\":true}", `${acting.name.text} ${JSON.stringify(acting.payload)}`);
      Assert.areEqual("desktop.commandsChanged,desktop.commandsChanged,desktop.agentControlChanged", stopping.map(t => t.name.text).join(","));
      Assert.isTrue(JSON.stringify(stopping[1]?.payload).includes(`${AgentControlTests.STOP},"isEnabled":false},${AgentControlTests.RESUME}}`), JSON.stringify(stopping[1]?.payload));
      Assert.areEqual("{\"isStopped\":true,\"isActing\":true}", JSON.stringify(stopping[2]?.payload));
      Assert.isFalse(stopped.hasFailed);
      Assert.areEqual("Stopped", refused.isFailure ? refused.code : null);
      Assert.areEqual("desktop.commandsChanged,desktop.commandsChanged,desktop.agentControlChanged", resuming.map(t => t.name.text).join(","));
      Assert.isTrue(JSON.stringify(resuming[1]?.payload).includes(`${AgentControlTests.STOP}},${AgentControlTests.RESUME},"isEnabled":false}`), JSON.stringify(resuming[1]?.payload));
      Assert.areEqual("{\"isStopped\":false,\"isActing\":true}", JSON.stringify(resuming[2]?.payload));
      Assert.isFalse(resumed.hasFailed);
      Assert.areEqual("{\"isStopped\":false,\"isActing\":true}", JSON.stringify(current.payload));
    });
  }

  @TestMethod
  public letsTheCommandLineStopButRefusesItsResume(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync();
      await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);

      cli.sendMessages(new Request("cli:1", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("desktop.stopAgentControl"), null).toJson()));
      const stopping = [await cli.readEventAsync(), await cli.readEventAsync(), await cli.readEventAsync()];
      const stopped = await cli.readResponseAsync();
      const refused = await RuntimeHostFixture.callAsync(cli, "cli:2", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("desktop.resumeAgentControl"), null).toJson());
      const stillStopped = host.modules.tools.isStopped;
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual("desktop.agentControlChanged {\"isStopped\":true,\"isActing\":false}", `${stopping[2]?.name.text} ${JSON.stringify(stopping[2]?.payload)}`);
      Assert.isFalse(stopped.hasFailed);
      Assert.areEqual("Unauthorized|Only the app's window and tray resume agent control; the client cli can't.", `${refused.failure?.code}|${refused.failure?.message}`);
      Assert.isTrue(stillStopped);
    });
  }
}
