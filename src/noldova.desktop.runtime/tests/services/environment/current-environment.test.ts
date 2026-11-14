/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import type { IEnvironmentSource } from "../../../src/interfaces/i-environment-source.js";
import { CurrentEnvironment } from "../../../src/services/environment/current-environment.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class CurrentEnvironmentTests {
  private static readonly READ: Readonly<Record<string, string>> = {
    PATH: "/usr/bin", ELECTRON_RUN_AS_NODE: "1", ELECTRON_NO_ATTACH_CONSOLE: "1", electron_run_as_node: "1", "=C:": "C:\\Projects", EDITOR: "vim",
    PWD: "/home/person", OLDPWD: "/", SHLVL: "2", _: "/usr/bin/env"
  };
  private static readonly MARKER: string = "NOLDOVA_DESKTOP_ENVIRONMENT_MARKER";
  private static readonly PROFILE_VARIABLE: string = "NOLDOVA_DESKTOP_PROFILE_VALUE";

  @TestMethod
  public async leavesOutNoldovaDesktopsOwnVariablesTheShellsOwnAndNamesAProgramCannotTakeMatchingTheirCaseOutsideWindows(): Promise<void> {
    let ends = 0;
    const source: IEnvironmentSource = { readAsync: () => Promise.resolve(CurrentEnvironmentTests.READ), end: () => { ends++; } };
    const environment = new CurrentEnvironment("linux", source);

    const read = await environment.readAsync();
    environment.end();

    Assert.areEqual(JSON.stringify({ PATH: "/usr/bin", electron_run_as_node: "1", EDITOR: "vim" }), JSON.stringify(read));
    Assert.areEqual(1, ends);
  }

  @TestMethod
  public async leavesOutNoldovaDesktopsOwnVariablesInAnyCaseOnWindows(): Promise<void> {
    const source: IEnvironmentSource = { readAsync: () => Promise.resolve(CurrentEnvironmentTests.READ), end: () => undefined };

    const read = await new CurrentEnvironment("win32", source).readAsync();

    Assert.areEqual(JSON.stringify({ PATH: "/usr/bin", EDITOR: "vim", PWD: "/home/person", OLDPWD: "/", SHLVL: "2", _: "/usr/bin/env" }), JSON.stringify(read));
  }

  @TestMethod
  public async readsWindowsThroughWindowsPowerShellAndGivesTheInheritedVariablesWhenItCannotBeFound(): Promise<void> {
    const diagnostics = new TextOutputFixture();
    const environment = CurrentEnvironment.create("win32", { Path: "C:\\Windows", TEMP: undefined }, diagnostics);

    const read = await environment.readAsync();
    environment.end();

    Assert.areEqual(JSON.stringify({ Path: "C:\\Windows" }), JSON.stringify(read));
    Assert.isTrue(diagnostics.text.endsWith("SystemRoot is not set, so Windows PowerShell can't be found.\n"));
  }

  @TestMethod
  public async readsOtherSystemsThroughTheLoginShellKeepingTheVariablesTheAppStartedWith(): Promise<void> {
    await using home = await TemporaryFolderFixture.createAsync();
    const environment = CurrentEnvironment.create("linux", {
      ...process.env, HOME: home.path, SHELL: path.join(home.path, "missing-shell"), [CurrentEnvironmentTests.MARKER]: "kept", ELECTRON_RUN_AS_NODE: "1"
    }, new TextOutputFixture());

    const read = await environment.readAsync();
    environment.end();

    Assert.areEqual("kept", read[CurrentEnvironmentTests.MARKER]);
    Assert.isUndefined(read["ELECTRON_RUN_AS_NODE"]);
  }

  @TestMethod
  public async startsNothingOnceEndedWhenHomeIsNotSet(): Promise<void> {
    const environment = CurrentEnvironment.create("linux", { [CurrentEnvironmentTests.MARKER]: "kept" }, new TextOutputFixture());

    environment.end();
    const read = await environment.readAsync();

    Assert.areEqual(JSON.stringify({ [CurrentEnvironmentTests.MARKER]: "kept" }), JSON.stringify(read));
  }

  @TestMethod
  @PlatformFixture.posixOnly()
  public async readsWhatThePersonsProfileExportsAndReadsAgainAfterTheProfileChanges(): Promise<void> {
    await using home = await TemporaryFolderFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    await CurrentEnvironmentTests.writeProfilesAsync(home.path, "first");
    const environment = CurrentEnvironment.create(process.platform, { ...process.env, HOME: home.path, ZDOTDIR: undefined }, diagnostics);

    try {
      const first = await environment.readAsync();
      await CurrentEnvironmentTests.writeProfilesAsync(home.path, "second");
      const isReread = await WaitFixture.untilAsync(async () => (await environment.readAsync())[CurrentEnvironmentTests.PROFILE_VARIABLE] === "second", 20_000);

      Assert.areEqual("first", first[CurrentEnvironmentTests.PROFILE_VARIABLE], diagnostics.text);
      Assert.isTrue(isReread, diagnostics.text);
      Assert.isUndefined(first["ELECTRON_RUN_AS_NODE"]);
    }
    finally {
      environment.end();
    }
  }

  private static async writeProfilesAsync(home: string, value: string): Promise<void> {
    const line = `export ${CurrentEnvironmentTests.PROFILE_VARIABLE}=${value}\n`;
    await writeFile(path.join(home, ".profile"), line);
    await writeFile(path.join(home, ".zprofile"), line);
  }
}
