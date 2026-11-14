/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CommandRun, FailureCode, QualifiedName, Request, ShellMethods, StopPolicy, StopRequest } from "@noldova/desktop.protocol";
import { RuntimeBuild } from "@noldova/desktop.runtime";

import { RuntimeHostFixture } from "../../fixtures/runtime-host.fixture.js";

@TestClass
export class StopMethodTests {
  @TestMethod
  public reportsAModulesWorkAndStopsItOnlyWhenAskedToStopTheWork(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createWorkPart()]]));
      const [connection] = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      connection.sendMessages(new Request("main:1", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), null).toJson()));
      const began = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      const refused = await RuntimeHostFixture.callAsync(connection, "main:2", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle).toJson());
      connection.sendMessages(new Request("main:3", ShellMethods.stop, new StopRequest(StopPolicy.StopWork).toJson()));
      const ended = [await connection.readEventAsync(), await connection.readResponseAsync()] as const;
      await host.waitForStopAsync();

      Assert.areEqual("desktop.work|{\"descriptions\":[\"Ticking\"],\"sequence\":1}|null", `${began[0].name.text}|${JSON.stringify(began[0].payload)}|${JSON.stringify(began[1].payload)}`);
      Assert.areEqual(`${FailureCode.Conflict}|{"descriptions":["Ticking"]}`, `${refused.failure?.code}|${JSON.stringify(refused.failure?.details)}`);
      Assert.areEqual("desktop.work|{\"descriptions\":[],\"sequence\":2}|null", `${ended[0].name.text}|${JSON.stringify(ended[0].payload)}|${JSON.stringify(ended[1].payload)}`);
      Assert.isTrue(existsSync(path.join(fixture.dataDirectory.locateWorkFolder("clock"), "aborted")));
      Assert.isTrue((await readFile(fixture.dataDirectory.runtimeLog, "utf8")).includes("clock: Ticking began\n"));
    });
  }

  @TestMethod
  public keepsTheRuntimeAndItsWorkForAClientThatConnectedFirstWhileTheCliStopStaysUnchanged(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createWorkPart()]]));
      const [cli] = await fixture.handshakeAsync("cli", RuntimeBuild.identity);
      const [mainProcess] = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      mainProcess.sendMessages(new Request("main:1", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), null).toJson()));
      await RuntimeHostFixture.readMessagesAsync(mainProcess, 2);
      const kept = await RuntimeHostFixture.callAsync(mainProcess, "main:2", ShellMethods.stop, new StopRequest(StopPolicy.StopWork, true).toJson());
      const descriptions = [...host.work.descriptions];
      cli.sendMessages(new Request("cli:1", ShellMethods.stop, new StopRequest(StopPolicy.StopWork).toJson()));
      const [responses, events] = await RuntimeHostFixture.readMessagesAsync(cli, 3);
      await host.waitForStopAsync();

      Assert.areEqual("{\"keptFor\":1}", JSON.stringify(kept.payload));
      Assert.areEqual("[\"Ticking\"]", JSON.stringify(descriptions));
      Assert.areEqual("null", JSON.stringify(responses.get("cli:1")?.payload));
      Assert.areEqual("[{\"descriptions\":[\"Ticking\"],\"sequence\":1},{\"descriptions\":[],\"sequence\":2}]", JSON.stringify(events.map(t => t.payload)));
      Assert.isTrue(existsSync(path.join(fixture.dataDirectory.locateWorkFolder("clock"), "aborted")));
    });
  }

  @TestMethod
  public appliesThePolicyToAClientAloneAndKeepsTheRuntimeOnceAnotherConnectsEvenOfTheSameName(): Promise<void> {
    return RuntimeHostFixture.runAsync(async fixture => {
      const host = await fixture.startAsync(30_000, await fixture.writeModulesAsync([["clock", RuntimeHostFixture.createWorkPart()]]));
      const [mainProcess] = await fixture.handshakeAsync("main", RuntimeBuild.identity);

      mainProcess.sendMessages(new Request("main:1", ShellMethods.runCommand, new CommandRun(QualifiedName.parse("clock.tick"), null).toJson()));
      await RuntimeHostFixture.readMessagesAsync(mainProcess, 2);
      const refused = await RuntimeHostFixture.callAsync(mainProcess, "main:2", ShellMethods.stop, new StopRequest(StopPolicy.IfIdle, true).toJson());
      await fixture.handshakeAsync("main", RuntimeBuild.identity);
      const kept = await RuntimeHostFixture.callAsync(mainProcess, "main:3", ShellMethods.stop, new StopRequest(StopPolicy.StopWork, true).toJson());
      const descriptions = [...host.work.descriptions];
      mainProcess.sendMessages(new Request("main:4", ShellMethods.stop, new StopRequest(StopPolicy.StopWork).toJson()));
      const [responses] = await RuntimeHostFixture.readMessagesAsync(mainProcess, 2);
      await host.waitForStopAsync();

      Assert.areEqual(`${FailureCode.Conflict}|{"descriptions":["Ticking"]}`, `${refused.failure?.code}|${JSON.stringify(refused.failure?.details)}`);
      Assert.areEqual("{\"keptFor\":1}", JSON.stringify(kept.payload));
      Assert.areEqual("[\"Ticking\"]", JSON.stringify(descriptions));
      Assert.areEqual("null", JSON.stringify(responses.get("main:4")?.payload));
    });
  }
}
