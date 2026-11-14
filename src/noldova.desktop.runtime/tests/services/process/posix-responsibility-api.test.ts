/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { open, readFile, realpath } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { AddonIncompleteException, AddonUnexpectedValueException, ChildProcessStarter, type IPosixProcessAddon, NativeAddon, PosixProcessApi, PosixResponsibilityApi } from "@noldova/desktop.runtime";

import { AddonModuleFixture } from "../../fixtures/addon-module.fixture.js";
import { PlatformFixture } from "../../fixtures/platform.fixture.js";
import { ProcessProgramFixture } from "../../fixtures/process-program.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { WaitFixture } from "../../fixtures/wait.fixture.js";

@TestClass
export class PosixResponsibilityApiTests {
  private static readonly FUNCTIONS: readonly (keyof IPosixProcessAddon)[] = ["readResponsibleProcessId", "readProcessPath"];
  private static readonly DISCLAIM: string = "responsibility_spawnattrs_setdisclaim";
  private static readonly PARENT: string = [
    "const { spawn } = require('node:child_process');",
    "const { writeFileSync } = require('node:fs');",
    "const child = spawn('/bin/sleep', ['30'], { stdio: 'ignore' });",
    "writeFileSync(process.argv[1], String(child.pid));"
  ].join(" ");

  @TestMethod
  public wrapsThePackagesOwnAddonOnMacOSAloneWithoutLoadingIt(): void {
    Assert.areEqual(JSON.stringify([null, null]), JSON.stringify([PosixResponsibilityApi.create("linux"), PosixResponsibilityApi.create("win32")]));
    Assert.isInstanceOf(PosixResponsibilityApi.create("darwin"), PosixResponsibilityApi);
  }

  @TestMethod
  public async asksTheAddonForAProcesssResponsibleProcessThroughTheSystemsFunction(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ calls: [], readResponsibleProcessId(...values) { this.calls.push(values); return 501; }, readProcessPath: () => null }");
    const api = new PosixResponsibilityApi(new NativeAddon<IPosixProcessAddon>(fake.file, PosixResponsibilityApiTests.FUNCTIONS));

    const found = [api.findResponsible(4_321), api.findResponsible(4_321, "other_function")];

    Assert.areEqual(JSON.stringify([501, 501]), JSON.stringify(found));
    Assert.areEqual(JSON.stringify([[4_321, "responsibility_get_pid_responsible_for_pid"], [4_321, "other_function"]]), JSON.stringify(createRequire(import.meta.url)(fake.file).calls));
  }

  @TestMethod
  @TestData("0")
  @TestData("-1")
  @TestData("1.5")
  @TestData("'501'")
  public async refusesAResponsibleProcessIdThatIsNotAPositiveIntegerOrNull(value: string): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(`{ readResponsibleProcessId: () => ${value}, readProcessPath: () => null }`);

    Assert.throws(() => new PosixResponsibilityApi(new NativeAddon<IPosixProcessAddon>(fake.file, PosixResponsibilityApiTests.FUNCTIONS)).findResponsible(4_321), AddonUnexpectedValueException);
  }

  @TestMethod
  public async refusesAnAddonThatLacksTheFunctionItCalls(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ readProcessPath: () => null }");

    const error = Assert.throws(() => new PosixResponsibilityApi(new NativeAddon<IPosixProcessAddon>(fake.file, [])).findResponsible(4_321), AddonIncompleteException);

    Assert.areEqual(`The runtime's addon native/${AddonModuleFixture.TARGET}/fake-addon.cjs lacks functions this runtime calls; it comes from another build.`, error.message);
  }

  @TestMethod
  public async readsTheProgramAProcessRunsOrNullAndRefusesAnythingElse(): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync("{ readResponsibleProcessId: () => null, readProcessPath: t => t === 1 ? '/Applications/Noldova.app/Contents/MacOS/Noldova' : t === 2 ? null : 5 }");
    const program = new ProcessProgramFixture(new NativeAddon<IPosixProcessAddon>(fake.file, PosixResponsibilityApiTests.FUNCTIONS));

    Assert.areEqual(JSON.stringify(["/Applications/Noldova.app/Contents/MacOS/Noldova", null]), JSON.stringify([program.read(1), program.read(2)]));
    Assert.throws(() => program.read(3), AddonUnexpectedValueException);
  }

  @TestMethod
  @TestData("4321", "null")
  @TestData("501", "\"This runtime is not its own responsible process, so its start could not hand it responsibility: programs that modules start ask for privacy permissions in the name of whatever started the app, such as a terminal.\"")
  @TestData("null", "\"macOS gives no way to read this runtime's responsible process, so its start could not hand it responsibility: programs that modules start may ask for privacy permissions in the name of whatever started the app, such as a terminal.\"")
  public async saysWhyAProcessIsNotItsOwnResponsibleProcess(responsible: string, expected: string): Promise<void> {
    await using fake = await AddonModuleFixture.createAsync(`{ readResponsibleProcessId: () => ${responsible}, readProcessPath: () => null }`);

    Assert.areEqual(expected, JSON.stringify(new PosixResponsibilityApi(new NativeAddon<IPosixProcessAddon>(fake.file, PosixResponsibilityApiTests.FUNCTIONS)).describe(4_321)));
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async startsAProgramAsItsOwnResponsibleProcessWhichPassesThatToWhatItStartsOnMacOS(): Promise<void> {
    const api = PosixResponsibilityApiTests.createOnMacOS();
    await PosixResponsibilityApiTests.runAsync(ChildProcessStarter.create("darwin"), async (program, child) => {
      const responsible = api.findResponsible(child);

      Assert.areEqual(program, api.findResponsible(program));
      Assert.areEqual(program, responsible);
      Assert.areEqual(await realpath(process.execPath), ProcessProgramFixture.create().read(responsible ?? 0));
      Assert.areNotEqual(program, api.findResponsible(process.pid));
    });
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async startsAProgramWithoutDisclaimingWhenTheSystemHasNoSuchFunctionOnMacOS(): Promise<void> {
    const api = PosixResponsibilityApiTests.createOnMacOS();
    await PosixResponsibilityApiTests.runAsync(new ChildProcessStarter("darwin", PosixProcessApi.create(), true, "noldova_missing_disclaim"), async (program, child) => {
      const own = api.findResponsible(process.pid);

      Assert.isNotNull(own);
      Assert.areEqual(JSON.stringify([own, own]), JSON.stringify([api.findResponsible(program), api.findResponsible(child)]));
      Assert.areNotEqual(program, own);
    });
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public async namesBothFailuresWhenTheDisclaimedSpawnAndThePlainStartFailOnMacOS(): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const errors = await open(path.join(folder.path, "start.log"), "w");
    try {
      const missing = path.join(folder.path, "missing-program");

      const failure = Assert.throws(() => PosixProcessApi.create("darwin").startDetached(missing, [], [], errors.fd, undefined, undefined, undefined, PosixResponsibilityApiTests.DISCLAIM), Error);

      Assert.areEqual("posix_spawn failed: No such file or directory; execve failed: No such file or directory", failure.message);
    }
    finally {
      await errors.close();
    }
  }

  @TestMethod
  @PlatformFixture.macOnly()
  public answersNullWhenTheSystemHasNoSuchResponsibleFunctionOnMacOS(): void {
    const api = PosixResponsibilityApiTests.createOnMacOS();

    Assert.isNotNull(api.findResponsible(process.pid));
    Assert.isNull(api.findResponsible(process.pid, "noldova_missing_responsible"));
  }

  private static createOnMacOS(): PosixResponsibilityApi {
    const api = PosixResponsibilityApi.create("darwin");
    if (Object.isNull(api))
      throw new Error("There is no responsibility API on macOS.");
    return api;
  }

  private static async runAsync(starter: ChildProcessStarter, test: (program: number, child: number) => Promise<void>): Promise<void> {
    await using folder = await TemporaryFolderFixture.createAsync();
    const result = path.join(folder.path, "child.txt");
    const program = await starter.startAsync(process.execPath, ["-e", PosixResponsibilityApiTests.PARENT, result], process.env, path.join(folder.path, "start.log"));
    let child = 0;
    try {
      Assert.isTrue(await WaitFixture.untilAsync(async () => (await readFile(result, "utf8").catch(() => String.empty)).length > 0, 10_000), "The program did not start its child within 10 s.");
      child = Number(await readFile(result, "utf8"));
      await test(program, child);
    }
    finally {
      [child, program].filter(t => t > 0).forEach(t => PosixResponsibilityApiTests.end(t));
    }
  }

  private static end(processId: number): boolean {
    try {
      return process.kill(processId, "SIGKILL");
    }
    catch {
      return false;
    }
  }
}
