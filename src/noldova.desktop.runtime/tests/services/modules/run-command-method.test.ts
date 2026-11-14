/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandRun, FailureCode, QualifiedName, Request, ShellMethods } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class RunCommandMethodTests {
  @TestMethod
  public runsAModulesCommandForItsWindowAndRefusesOneThatIsMissingMalformedOrDisabled(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createCommandPart()]]));
      const [connection] = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      const ran = await RuntimeHostFixture.callAsync(connection, "main:1", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), { by: 2 }).toJson());
      connection.sendMessages(new Request("main:6", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), null).toJson(), undefined, 7));
      const fromWindow = await connection.readResponseAsync();
      const missing = await RuntimeHostFixture.callAsync(connection, "main:2", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.reset"), null).toJson());
      const invalid = await RuntimeHostFixture.callAsync(connection, "main:3", ShellMethods.runCommand, { name: "clock.tick" });
      connection.sendMessages(new Request("main:4", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.pause"), null).toJson()));
      await connection.readEventAsync();
      await connection.readResponseAsync();
      const refused = await RuntimeHostFixture.callAsync(connection, "main:5", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), null).toJson());
      host.requestStop("test");
      await host.waitForStopAsync();

      Assert.areEqual("{\"client\":\"main\",\"window\":null,\"arguments\":{\"by\":2}}", JSON.stringify(ran.payload));
      Assert.areEqual("{\"client\":\"main\",\"window\":7,\"arguments\":null}", JSON.stringify(fromWindow.payload));
      Assert.areEqual(FailureCode.NotFound, missing.failure?.code);
      Assert.areEqual("The command clock.reset is not registered; its module may not be active.", missing.failure?.message);
      Assert.areEqual(FailureCode.InvalidParams, invalid.failure?.code);
      Assert.areEqual(FailureCode.Unavailable, refused.failure?.code);
      Assert.areEqual("The command clock.tick is not enabled now.", refused.failure?.message);
    });
  }
}
