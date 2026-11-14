/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { PackagedModules } from "../../../src/services/packaging/packaged-modules.js";

@TestClass
export class PackagedModulesTests {
  private static readonly DECLARED: readonly { id: string; platforms: readonly string[] | null; dependencies: readonly string[]; switchSetting: string | null }[] = [
    { id: "notes", platforms: null, dependencies: [], switchSetting: null },
    { id: "shade", platforms: ["windows", "macos"], dependencies: [], switchSetting: null }
  ];
  private static readonly CHAINED: readonly { id: string; platforms: readonly string[] | null; dependencies: readonly string[]; switchSetting: string | null }[] = [
    ...PackagedModulesTests.DECLARED,
    { id: "tint", platforms: null, dependencies: ["shade"], switchSetting: null },
    { id: "palette", platforms: null, dependencies: ["tint", "palette"], switchSetting: null },
    { id: "clock", platforms: null, dependencies: ["notes"], switchSetting: null }
  ];

  @TestMethod
  public acceptsEveryModuleActiveAndOneUnavailableOnAPlatformItLeavesOut(): void {
    const status = { modules: [{ id: "notes", state: "Active" }, { id: "shade", state: "Unavailable", cause: "It doesn't run on Linux." }] };

    Assert.areEqual("The installed app's modules are active: notes; shade unavailable on linux, which it leaves out.",
      PackagedModules.verify(status, PackagedModulesTests.DECLARED, "linux"));
  }

  @TestMethod
  public acceptsModulesOffByTheirSwitchSettingsAndRefusesOneOffWithoutOne(): void {
    const declared = [
      ...PackagedModulesTests.DECLARED,
      { id: "assist", platforms: null, dependencies: [], switchSetting: "assist.enabled" },
      { id: "camera", platforms: null, dependencies: [], switchSetting: "camera.enabled" }
    ];
    const modules = [{ id: "notes", state: "Active" }, { id: "shade", state: "Active" }, { id: "assist", state: "Off" }];

    const accepted = [
      PackagedModules.verify({ modules }, declared.slice(0, 3), "windows"),
      PackagedModules.verify({ modules: [...modules, { id: "camera", state: "Off" }] }, declared, "windows")
    ];
    const refused = Assert.throws(() => PackagedModules.verify({ modules: [{ id: "notes", state: "Off" }, { id: "shade", state: "Active" }] }, declared.slice(0, 2), "windows"), BuildException);

    Assert.areEqual(JSON.stringify([
      "The installed app's modules are active: notes, shade; assist off by its switch setting.",
      "The installed app's modules are active: notes, shade; assist, camera off by their switch setting."
    ]), JSON.stringify(accepted));
    Assert.areEqual("The installed app's modules are not all active: notes is Off.", refused.message);
  }

  @TestMethod
  public acceptsAnAppWithNoModules(): void {
    Assert.areEqual("The installed app has no modules.", PackagedModules.verify({ modules: [] }, [], "windows"));
  }

  @TestMethod
  public acceptsAModuleBlockedByADependencyChainThatReachesOneThePlatformLeavesOut(): void {
    const status = { modules: [
      { id: "notes", state: "Active" }, { id: "shade", state: "Unavailable" }, { id: "tint", state: "Blocked" }, { id: "palette", state: "Blocked" }, { id: "clock", state: "Active" }
    ] };

    Assert.areEqual("The installed app's modules are active: notes, clock; shade unavailable on linux, which it leaves out; tint, palette blocked by a dependency linux leaves out.",
      PackagedModules.verify(status, PackagedModulesTests.CHAINED, "linux"));
  }

  @TestMethod
  public async refusesABlockedModuleWhoseDependenciesThePlatformKeeps(): Promise<void> {
    const status = { modules: [
      { id: "notes", state: "Active" }, { id: "shade", state: "Active" }, { id: "tint", state: "Blocked" }, { id: "palette", state: "Active" }, { id: "clock", state: "Blocked" }
    ] };
    const error = await Assert.throwsAsync(() => Promise.resolve(PackagedModules.verify(status, PackagedModulesTests.CHAINED, "windows")), BuildException);

    Assert.areEqual("The installed app's modules are not all active: tint is Blocked; clock is Blocked.", error.message);
  }

  @TestMethod
  public async refusesABlockedModuleTheAppDoesNotDeclare(): Promise<void> {
    const status = { modules: [{ id: "notes", state: "Active" }, { id: "shade", state: "Active" }, { id: "ghost", state: "Blocked" }] };
    const error = await Assert.throwsAsync(() => Promise.resolve(PackagedModules.verify(status, PackagedModulesTests.DECLARED, "windows")), BuildException);

    Assert.areEqual("The installed app's modules are not all active: ghost is Blocked.", error.message);
  }

  @TestMethod
  public async refusesADeclaredModuleMissingFromStatusAndNamesIt(): Promise<void> {
    const error = await Assert.throwsAsync(() => Promise.resolve(PackagedModules.verify({ modules: [{ id: "notes", state: "Active" }] }, PackagedModulesTests.DECLARED, "windows")), BuildException);

    Assert.areEqual("The installed app's modules are not all active: shade is missing from status.", error.message);
  }

  @TestMethod
  public async refusesAModuleThatIsNotActiveWithItsStateAndCause(): Promise<void> {
    const status = { modules: [{ id: "notes", state: "Failed", cause: "Its runtime part failed to activate." }, { id: "shade", state: "Unavailable" }, { id: "clock", state: "Off" }, {}] };
    const error = await Assert.throwsAsync(() => Promise.resolve(PackagedModules.verify(status, PackagedModulesTests.DECLARED, "macos")), BuildException);

    Assert.areEqual("The installed app's modules are not all active: notes is Failed (Its runtime part failed to activate.); shade is Unavailable; clock is Off; "
      + "a module without an id is in no state.", error.message);
  }

  @TestMethod
  public async refusesAStatusWithoutItsModules(): Promise<void> {
    const error = await Assert.throwsAsync(() => Promise.resolve(PackagedModules.verify({ dataDirectory: "/data" }, PackagedModulesTests.DECLARED, "linux")), BuildException);

    Assert.areEqual("The installed app's status --json answered without its modules: {\"dataDirectory\":\"/data\"}", error.message);
  }
}
