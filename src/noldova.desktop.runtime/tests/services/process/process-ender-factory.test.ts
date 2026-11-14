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
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { SimulatedProcessesFixture } from "../../fixtures/simulated-processes.fixture.js";
import { WindowsProcessApiFixture } from "../../fixtures/windows-process-api.fixture.js";

@TestClass
export class ProcessEnderFactoryTests {
  @TestMethod
  public async readsTheProcessTableThroughThePosixApiOnPosixAndTheSystemsOwnFunctionsOnWindows(): Promise<void> {
    await using linuxSettings = await SettingsFixture.createAsync();
    await using windowsSettings = await SettingsFixture.createAsync();
    using simulated = new SimulatedProcessesFixture();
    simulated.add(900_951, 900_951);
    const linuxNow = ProcessSupervisorFixture.LINUX.now();
    const windowsNow = ProcessSupervisorFixture.WINDOWS.now();
    linuxSettings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_951, "tool", "/usr/bin/tool", ProcessSupervisorFixture.LINUX.boot, linuxNow, linuxNow, linuxNow, 0);
    windowsSettings.database.run(ProcessSupervisorFixture.INSERT, "notes", 900_952, "tool", "C:\\Tools\\tool.exe", ProcessSupervisorFixture.WINDOWS.boot, windowsNow, windowsNow, windowsNow,
      ProcessSupervisorFixture.WINDOWS.offset());
    const linuxTable = new ProcessTableFixture([new Error("The table could not be read.")]);
    const windowsTable = new ProcessTableFixture([]);
    const windows = new WindowsProcessApiFixture([new Error("The process snapshot failed with Windows error 8.")]);

    await ProcessSupervisorFixture.createLinux(linuxSettings, linuxTable).cleanUpAsync();
    await ProcessSupervisorFixture.createWindows(windowsSettings, windows, windowsTable).cleanUpAsync();

    Assert.areEqual(1, linuxTable.reads);
    Assert.areEqual(1, windows.listings);
    Assert.areEqual(0, windowsTable.reads);
  }
}
