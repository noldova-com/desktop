/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ModuleState, ModuleStatus } from "@noldova/desktop.protocol";

@TestClass
export class ModuleStatusTests {
  private static readonly DECLARED: string =
    "\"id\":\"notes\",\"version\":\"1.2.3\",\"displayName\":\"Notes\",\"description\":\"Keeps notes.\",\"dependencies\":[\"tasks\"],\"contributes\":{\"commands\":[\"notes.newNote\"],\"views\":[]}";
  private static readonly CONTRIBUTIONS: ReadonlyMap<string, readonly string[]> = new Map([["commands", ["notes.newNote"]], ["views", []]]);

  @TestMethod
  public pinsItsWireFormWithACauseOnlyWhenNotActiveAndTheBlockerOnlyWhenBlocked(): void {
    const active = `{${ModuleStatusTests.DECLARED},"state":"Active"}`;
    const failed = `{${ModuleStatusTests.DECLARED},"state":"Failed","cause":"Its runtime part could not be loaded."}`;
    const blocked = `{${ModuleStatusTests.DECLARED},"state":"Blocked","cause":"It depends on tasks, which is not active.","blockedBy":"tasks"}`;

    Assert.areEqual(active, JSON.stringify(ModuleStatusTests.create(ModuleState.Active, null).toJson()));
    Assert.areEqual(failed, JSON.stringify(ModuleStatusTests.create(ModuleState.Failed, "Its runtime part could not be loaded.").toJson()));
    Assert.areEqual(blocked, JSON.stringify(ModuleStatusTests.create(ModuleState.Blocked, "It depends on tasks, which is not active.", "tasks").toJson()));
    for (const text of [active, failed, blocked])
      Assert.areEqual(text, JSON.stringify(ModuleStatus.fromJson(JsonReader.parse(text).toJson()).toJson()));
  }

  @TestMethod
  public listsWhatItDeclaresByKindAndKeepsItsOwnCopies(): void {
    const dependencies = ["tasks"];
    const commands = ["notes.newNote"];
    const status = new ModuleStatus("notes", "1.2.3", "Notes", "Keeps notes.", dependencies, new Map([["commands", commands]]), ModuleState.Active, null);
    dependencies.push("clock");
    commands.push("notes.open");

    Assert.areEqual("1.2.3 Notes Keeps notes.", `${status.version} ${status.displayName} ${status.description}`);
    Assert.areEqual("tasks", status.dependencies.join(","));
    Assert.areEqual("notes.newNote", status.listContributions("commands").join(","));
    Assert.areEqual(0, status.listContributions("menus").length);
    Assert.isNull(status.blockedBy);
  }

  @TestMethod
  public carriesItsOptionalDependenciesOnTheWireOnlyWhenItHasSomeAndThroughAChangeOfState(): void {
    const optional = ["clock"];
    const status = new ModuleStatus("notes", "1.2.3", "Notes", "Keeps notes.", ["tasks"], ModuleStatusTests.CONTRIBUTIONS, ModuleState.Active, null, null, optional);
    optional.push("calendar");
    const text = `{${ModuleStatusTests.DECLARED},"state":"Active","optionalDependencies":["clock"]}`;

    Assert.areEqual(text, JSON.stringify(status.toJson()));
    Assert.areEqual(text, JSON.stringify(ModuleStatus.fromJson(JsonReader.parse(text).toJson()).toJson()));
    Assert.areEqual("clock", status.withState(ModuleState.Failed, "Its runtime part could not be loaded.").optionalDependencies.join(","));
    Assert.areEqual(0, ModuleStatusTests.create(ModuleState.Active, null).optionalDependencies.length);
  }

  @TestMethod
  public carriesAnOffModuleWithoutACauseAndItsSwitchSettingOnTheWireOnlyWhenItHasOne(): void {
    const off = `{${ModuleStatusTests.DECLARED},"state":"Off","switchSetting":"notes.enabled"}`;
    const status = ModuleStatusTests.create(ModuleState.Off, null, null, "notes.enabled");

    Assert.areEqual(off, JSON.stringify(status.toJson()));
    Assert.areEqual(off, JSON.stringify(ModuleStatus.fromJson(JsonReader.parse(off).toJson()).toJson()));
    Assert.areEqual("Off null null", `${status.state} ${status.cause} ${status.blockedBy}`);
    Assert.areEqual(`{${ModuleStatusTests.DECLARED},"state":"Active","switchSetting":"notes.enabled"}`, JSON.stringify(status.withState(ModuleState.Active, null).toJson()));
    Assert.isNull(ModuleStatusTests.create(ModuleState.Active, null).switchSetting);
  }

  @TestMethod
  public carriesAnUnavailableModuleWithItsCauseAndRefusesOneWithout(): void {
    const unavailable = `{${ModuleStatusTests.DECLARED},"state":"Unavailable","cause":"It doesn't run on Linux."}`;
    const status = ModuleStatusTests.create(ModuleState.Unavailable, "It doesn't run on Linux.");

    Assert.areEqual(unavailable, JSON.stringify(status.toJson()));
    Assert.areEqual(unavailable, JSON.stringify(ModuleStatus.fromJson(JsonReader.parse(unavailable).toJson()).toJson()));
    Assert.areEqual("cause", Assert.throws(() => ModuleStatusTests.create(ModuleState.Unavailable, null), ArgumentException).parameterName);
  }

  @TestMethod
  public returnsTheSameModuleInAnotherState(): void {
    const blocked = ModuleStatusTests.create(ModuleState.Active, null).withState(ModuleState.Blocked, "It depends on tasks, which is not active.", "tasks");
    const failed = blocked.withState(ModuleState.Failed, "Its window part could not be loaded.");

    Assert.areEqual(`Blocked tasks ${ModuleStatusTests.CONTRIBUTIONS.size}`, `${blocked.state} ${blocked.blockedBy} ${blocked.contributions.size}`);
    Assert.areEqual("Failed null Notes 1.2.3", `${failed.state} ${failed.blockedBy} ${failed.displayName} ${failed.version}`);
  }

  @TestMethod
  public ignoresFieldsALaterBuildAdds(): void {
    const status = ModuleStatus.fromJson({ ...JsonReader.parse(`{${ModuleStatusTests.DECLARED}}`).toJson(), state: "Failed", cause: "Its runtime part could not be loaded.", retryable: true });

    Assert.areEqual(ModuleState.Failed, status.state);
    Assert.areEqual("Its runtime part could not be loaded.", status.cause);
  }

  @TestMethod
  public refusesBlankNamesAndACauseOrBlockerThatDoesNotMatchTheState(): void {
    Assert.throws(() => new ModuleStatus(" ", "1.2.3", "Notes", "Keeps notes.", [], new Map(), ModuleState.Active, null), ArgumentException);
    Assert.throws(() => new ModuleStatus("notes", "1.2.3", " ", "Keeps notes.", [], new Map(), ModuleState.Active, null), ArgumentException);
    Assert.throws(() => new ModuleStatus("notes", "1.2.3", "Notes", " ", [], new Map(), ModuleState.Active, null), ArgumentException);
    Assert.throws(() => ModuleStatusTests.create(ModuleState.Active, "Its runtime part failed to activate."), ArgumentException);
    Assert.throws(() => ModuleStatusTests.create(ModuleState.Failed, null), ArgumentException);
    Assert.throws(() => ModuleStatusTests.create(ModuleState.Blocked, " ", "tasks"), ArgumentException);
    Assert.areEqual("blockedBy", Assert.throws(() => ModuleStatusTests.create(ModuleState.Blocked, "It depends on tasks.", null), ArgumentException).parameterName);
    Assert.areEqual("blockedBy", Assert.throws(() => ModuleStatusTests.create(ModuleState.Blocked, "It depends on clock.", "clock"), ArgumentException).parameterName);
    Assert.areEqual("blockedBy", Assert.throws(() => ModuleStatusTests.create(ModuleState.Failed, "It broke.", "tasks"), ArgumentException).parameterName);
    Assert.areEqual("cause", Assert.throws(() => ModuleStatusTests.create(ModuleState.Off, "It is off.", null, "notes.enabled"), ArgumentException).parameterName);
    Assert.areEqual("blockedBy", Assert.throws(() => ModuleStatusTests.create(ModuleState.Off, null, "tasks", "notes.enabled"), ArgumentException).parameterName);
    Assert.areEqual("switchSetting", Assert.throws(() => ModuleStatusTests.create(ModuleState.Off, null), ArgumentException).parameterName);
    Assert.areEqual("switchSetting", Assert.throws(() => ModuleStatusTests.create(ModuleState.Active, null, null, " "), ArgumentException).parameterName);
  }

  @TestMethod
  public acceptsOnlyAVersionOfThreeNumbers(): void {
    for (const version of ["0.0.1", "1.20.300", "999999999.0.0"])
      Assert.areEqual(version, new ModuleStatus("notes", version, "Notes", "Keeps notes.", [], new Map(), ModuleState.Active, null).version);
    for (const version of [String.empty, "1", "1.2", "1.2.3.4", "01.2.3", "1.02.3", "v1.2.3", "1.2.3-beta", "1.2.3 ", "1.-2.3", "1000000000.0.0"])
      Assert.areEqual("version", Assert.throws(() => new ModuleStatus("notes", version, "Notes", "Keeps notes.", [], new Map(), ModuleState.Active, null), ArgumentException).parameterName);
  }

  @TestMethod
  public namesTheFieldOfAnInvalidWireForm(): void {
    const declared = JsonReader.parse(`{${ModuleStatusTests.DECLARED}}`).toJson();
    const cases: readonly (readonly [Record<string, unknown>, string])[] = [
      [{ ...declared, state: "Failed" }, "$.cause"],
      [{ ...declared, state: "Paused" }, "$.state"],
      [{ ...declared, state: "Active", version: undefined }, "$.version"],
      [{ ...declared, state: "Active", version: "1.2" }, "$.version"],
      [{ ...declared, state: "Active", displayName: 1 }, "$.displayName"],
      [{ ...declared, state: "Active", dependencies: "tasks" }, "$.dependencies"],
      [{ ...declared, state: "Active", contributes: [] }, "$.contributes"],
      [{ ...declared, state: "Active", contributes: { commands: [1] } }, "$.contributes.commands.0"],
      [{ ...declared, state: "Blocked", cause: "It depends on tasks.", blockedBy: 2 }, "$.blockedBy"],
      [{ ...declared, state: "Active", optionalDependencies: "clock" }, "$.optionalDependencies"],
      [{ ...declared, state: "Off" }, "$.switchSetting"],
      [{ ...declared, state: "Active", switchSetting: true }, "$.switchSetting"]
    ];
    for (const [value, path] of cases)
      Assert.areEqual(path, Assert.throws(() => ModuleStatus.fromJson(value), JsonException).path);
  }

  private static create(state: ModuleState, cause: string | null, blockedBy: string | null = null, switchSetting: string | null = null): ModuleStatus {
    return new ModuleStatus("notes", "1.2.3", "Notes", "Keeps notes.", ["tasks"], ModuleStatusTests.CONTRIBUTIONS, state, cause, blockedBy, [], switchSetting);
  }
}
