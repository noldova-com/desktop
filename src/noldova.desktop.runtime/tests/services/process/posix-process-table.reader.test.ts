/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { ProcessTableFixture } from "../../fixtures/process-table.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class PosixProcessTableReaderTests {
  @TestMethod
  public async leavesAGroupItCouldNotListWhenItsProgramExitedCleanlyOnPosix(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    let leader = 0;
    const table = new ProcessTableFixture([
      new Error("The process table has a row that could not be read: not a row"),
      () => Promise.resolve(simulated.list(t => `${t} ${leader} ${leader} 00:00`))
    ]);
    const processes = ProcessSupervisorFixture.createLinux(settings, table);

    const owned = await processes.startAsync(ProcessSupervisorFixture.MODULE, ProgramFixture.request(folder.path, [ProgramFixture.EXIT, "0"]));
    leader = owned.processId;
    simulated.add(900_014, leader);
    await owned.exited;
    await ProcessSupervisorFixture.waitForAsync(() => processes.programs.some(t => t.hasExited));
    await processes.stopOwnedByAsync("other");
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    const text = settings.diagnostics.text;
    Assert.isTrue(text.startsWith(ProcessSupervisorFixture.line(owned, String.empty).trimEnd()), text);
    Assert.isTrue(text.includes("The process table has a row that could not be read: not a row"), text);
    Assert.isTrue(
      text.endsWith(ProcessSupervisorFixture.line(owned, "It was no longer running, and nothing showed that processes 900014 were what it started, so they were left running.")),
      text);
    Assert.areEqual(String.empty, simulated.signals.join(","));
    Assert.isTrue(simulated.isAlive(900_014));
    Assert.areEqual(2, table.reads);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
  }
}
