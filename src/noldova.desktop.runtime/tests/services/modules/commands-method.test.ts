/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandList, CommandRun, QualifiedName, Request, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class CommandsMethodTests {
  @TestMethod
  public listsItsModulesCommandsAndPublishesEachChange(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createCommandPart()]]));
      const [connection] = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      const listed = await RuntimeHostFixture.callAsync(connection, "main:1", ShellMethods.commands, null);
      connection.sendMessages(new Request("main:2", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.pause"), null).toJson()));
      const changes = [await connection.readEventAsync()];
      const paused = await connection.readResponseAsync();
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual(
        "{\"commands\":[{\"name\":\"desktop.stopAgentControl\",\"title\":\"Stop agents\",\"icon\":\"stop_circle\",\"defaultKey\":\"Mod+Shift+Period\"},{\"name\":\"desktop.resumeAgentControl\",\"title\":\"Resume agents\",\"icon\":\"play_circle\",\"isEnabled\":false},{\"name\":\"clock.tick\",\"title\":\"Tick\",\"icon\":\"timer\",\"defaultKey\":\"Mod+Alt+T\"},{\"name\":\"clock.pause\",\"title\":\"Pause\",\"isChecked\":false}],\"sequence\":4}",
        JSON.stringify(CommandList.fromJson(listed.payload).toJson()));
      Assert.areEqual("desktop.commandsChanged", changes.map(t => t.name.text).join(","));
      Assert.areEqual(
        "{\"commands\":[{\"name\":\"desktop.stopAgentControl\",\"title\":\"Stop agents\",\"icon\":\"stop_circle\",\"defaultKey\":\"Mod+Shift+Period\"},{\"name\":\"desktop.resumeAgentControl\",\"title\":\"Resume agents\",\"icon\":\"play_circle\",\"isEnabled\":false},{\"name\":\"clock.tick\",\"title\":\"Tick\",\"icon\":\"timer\",\"defaultKey\":\"Mod+Alt+T\",\"isEnabled\":false},{\"name\":\"clock.pause\",\"title\":\"Pause\",\"isChecked\":false}],\"sequence\":5}",
        changes.map(t => JSON.stringify(t.payload)).join("|"));
      Assert.isFalse(paused.hasFailed);
    });
  }
}
