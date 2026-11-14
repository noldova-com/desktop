/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { once } from "node:events";
import { realpathSync } from "node:fs";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ProcessRequest } from "@noldova/desktop.runtime";

import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProcessSupervisorFixture } from "../../fixtures/process-supervisor.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";

@TestClass
export class ProcessEnvironmentTests {
  @TestMethod
  public async startsAProgramFoundOnThePathInItsFolderWithOnlyTheVariablesItIsGiven(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const runtime: NodeJS.ProcessEnv = {
      ...Object.fromEntries(Object.entries(process.env).filter(([t]) => t.toUpperCase() !== "PATH")),
      PATH: path.dirname(process.execPath),
      NOLDOVA_DESKTOP_INHERITED: "kept",
      NOLDOVA_DESKTOP_DROPPED: "dropped"
    };
    const processes = ProcessSupervisorFixture.create(settings, process.platform, runtime);
    const name = path.basename(process.execPath, path.extname(process.execPath));

    const owned = await processes.startAsync(
      ProcessSupervisorFixture.MODULE,
      new ProcessRequest(name, [ProgramFixture.file, ProgramFixture.ENVIRONMENT], folder.path, { NOLDOVA_DESKTOP_SET: "set" }, ["NOLDOVA_DESKTOP_INHERITED", "NOLDOVA_DESKTOP_MISSING"]));
    const running = processes.programs.map(t => `${t.moduleId} ${t.program} ${t.processId} ${t.started.getTime()}`);
    const recorded = settings.database.readAll(ProcessSupervisorFixture.RECORDS);
    const runningBefore = owned.hasExited;
    let errors = String.empty;
    owned.errors.setEncoding("utf8");
    owned.errors.on("data", (t: string) => {
      errors += t;
    });
    const errorsEnded = once(owned.errors, "end");
    const output = JsonReader.parse(await ProgramFixture.readAllAsync(owned));
    const exit = await owned.exited;
    await errorsEnded;
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(process.execPath, owned.program);
    Assert.areEqual(`notes ${process.execPath} ${owned.processId} ${owned.started.getTime()}`, running.join(","));
    Assert.areEqual(JSON.stringify([{ module: "notes", program: process.execPath, process_id: owned.processId }]), JSON.stringify(recorded));
    Assert.isFalse(runningBefore);
    Assert.areEqual(realpathSync(folder.path), realpathSync(output.readString("folder")));
    Assert.areEqual(path.dirname(process.execPath), output.readString("path"));
    Assert.areEqual("[[\"NOLDOVA_DESKTOP_INHERITED\",\"kept\"],[\"NOLDOVA_DESKTOP_SET\",\"set\"]]", JSON.stringify(output.readValue("kept")));
    Assert.areEqual("environment", errors.trim());
    Assert.isTrue(exit.isClean);
    Assert.isTrue(owned.hasExited);
    Assert.areEqual(0, processes.programs.length);
    Assert.areEqual(0, settings.database.readAll(ProcessSupervisorFixture.RECORDS).length);
    Assert.areEqual(String.empty, settings.diagnostics.text);
  }

  @TestMethod
  @PlatformFixture.windowsOnly()
  public async givesAWindowsProgramTheSystemsUsualFolders(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const folders = ["SystemDrive", "LOCALAPPDATA", "APPDATA", "ProgramData", "ProgramFiles"];
    const unlisted = "CommonProgramFiles";
    const runtime: NodeJS.ProcessEnv = {
      ...Object.fromEntries(Object.entries(process.env).filter(([t]) => ![...folders, unlisted].some(u => u.toUpperCase() === t.toUpperCase()))),
      ...Object.fromEntries(folders.map(t => [t, path.join(folder.path, t)])),
      [unlisted]: path.join(folder.path, unlisted)
    };
    const processes = ProcessSupervisorFixture.create(settings, process.platform, runtime);

    const owned = await processes.startAsync(
      ProcessSupervisorFixture.MODULE,
      new ProcessRequest(process.execPath, [ProgramFixture.file, ProgramFixture.VARIABLES, ...folders, unlisted], folder.path));
    const output = await ProgramFixture.readAllAsync(owned);
    await owned.exited;
    await processes.stopOwnedByAsync(ProcessSupervisorFixture.MODULE);

    Assert.areEqual(JSON.stringify([...folders.map(t => [t, path.join(folder.path, t)]), [unlisted, null]]), output.trim());
  }
}
