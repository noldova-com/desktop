/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import type { JsonValue } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { DeclarationFieldInvalidException, DeclarationNotObjectException, ModuleDeclaration, ModuleIdDeviceException } from "@noldova/desktop.runtime";

@TestClass
export class ModuleDeclarationTests {
  private static readonly VALID: Readonly<Record<string, unknown>> = {
    id: "notes",
    version: "1.2.3",
    displayName: "Notes",
    description: "Keeps notes.",
    dependencies: { tasks: "1.0.0" },
    runtimePackage: "@noldova/desktop.notes.runtime",
    contributes: { methods: ["notes.list"], events: [] }
  };

  @TestMethod
  public readsADeclarationAndListsItsContributionsByKind(): void {
    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, laterField: true });
    const windowOnly = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, runtimePackage: null });

    Assert.areEqual("notes", declaration.id);
    Assert.areEqual("1.2.3", declaration.version);
    Assert.areEqual("Notes", declaration.displayName);
    Assert.areEqual("Keeps notes.", declaration.description);
    Assert.areEqual("tasks", declaration.dependencies.join(","));
    Assert.areEqual("@noldova/desktop.notes.runtime", declaration.runtimePackage);
    Assert.areEqual("notes.list", declaration.listContributions("methods").join(","));
    Assert.areEqual(0, declaration.listContributions("events").length);
    Assert.areEqual(0, declaration.listContributions("views").length);
    Assert.isNull(windowOnly.runtimePackage);
  }

  @TestMethod
  public readsItsCommandLinePackageAndCommandsOrNoneWhenTheyAreLeftOut(): void {
    const add = { name: "notes.add", summary: "Adds a note.", arguments: [], options: [] };
    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, cliPackage: "@noldova/desktop.notes.cli", cliCommands: [add] });
    const without = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, cliPackage: null });
    const commands: JsonValue[] = [add];

    const constructed = new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map(), null, new Map(), [], "@noldova/desktop.notes.cli", commands);
    commands.push(add);

    Assert.areEqual("@noldova/desktop.notes.cli", declaration.cliPackage);
    Assert.areEqual(JSON.stringify([add]), JSON.stringify(declaration.cliCommands));
    Assert.isNull(without.cliPackage);
    Assert.areEqual(0, without.cliCommands.length);
    Assert.isNull(ModuleDeclaration.fromJson(ModuleDeclarationTests.VALID).cliPackage);
    Assert.areEqual(1, constructed.cliCommands.length);
    Assert.isNull(new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map(), null, new Map()).cliPackage);
  }

  @TestMethod
  public acceptsOnlyTheExactVersionItReadsForADependency(): void {
    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, dependencies: { tasks: "1.0.0", clock: "0.2.0" } });
    const constructed = new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map([["tasks", "2.0.0"]]), null, new Map());

    Assert.areEqual("tasks,clock", declaration.dependencies.join(","));
    Assert.areEqual("1.0.0", declaration.dependencyVersions.get("tasks"));
    Assert.isTrue(declaration.accepts("tasks", "1.0.0"));
    Assert.isFalse(declaration.accepts("tasks", "1.0.1"));
    Assert.isTrue(declaration.accepts("clock", "0.2.0"));
    Assert.isFalse(declaration.accepts("clock", "0.2.1"));
    Assert.areEqual("tasks", constructed.dependencies.join(","));
    Assert.isTrue(constructed.accepts("tasks", "2.0.0"));
    Assert.isFalse(constructed.accepts("tasks", "2.0.1"));
    Assert.isFalse(constructed.accepts("tasks", "1.9.0"));
    Assert.isTrue(constructed.accepts("clock", "9.9.9"));
  }

  @TestMethod
  public readsOptionalDependenciesAndAcceptsOnlyTheExactVersionOfEach(): void {
    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, optionalDependencies: { clock: "0.2.0" } });
    const constructed = new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map(), null, new Map(), [], null, [], null, false, new Map([["clock", "1.0.0"]]));

    Assert.areEqual("clock", declaration.optionalDependencies.join(","));
    Assert.areEqual("0.2.0", declaration.optionalDependencyVersions.get("clock"));
    Assert.isTrue(declaration.accepts("clock", "0.2.0"));
    Assert.isFalse(declaration.accepts("clock", "0.2.1"));
    Assert.areEqual("1.0.0", constructed.optionalDependencyVersions.get("clock"));
    Assert.isFalse(constructed.accepts("clock", "1.0.1"));
    Assert.areEqual(0, ModuleDeclaration.fromJson(ModuleDeclarationTests.VALID).optionalDependencies.length);
  }

  @TestMethod
  public refusesOptionalDependenciesThatAreNotOneExactVersionEach(): void {
    Assert.areEqual(
      "A module declaration's optionalDependencies is missing or invalid.",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, optionalDependencies: { clock: "^0.2.0" } }), DeclarationFieldInvalidException).message);
    Assert.areEqual(
      "A module declaration's optionalDependencies is missing or invalid.",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, optionalDependencies: ["clock"] }), DeclarationFieldInvalidException).message);
    Assert.areEqual("dependencies", Assert.throws(
      () => new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map(), null, new Map(), [], null, [], null, false, new Map([["clock", "*"]])), ArgumentException).parameterName);
  }

  @TestMethod
  @TestData("^1.0.0")
  @TestData("~1.0.0")
  @TestData(">=1.0.0 <2.0.0")
  @TestData("*")
  @TestData("1.0")
  public refusesADependencyVersionThatIsNotExact(version: string): void {
    const failure = Assert.throws(() => new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map([["tasks", version]]), null, new Map()), ArgumentException);

    Assert.areEqual("dependencies", failure.parameterName);
  }

  @TestMethod
  public refusesToCompareAVersionThatIsNotAModulesVersion(): void {
    const declaration = new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map([["tasks", "1.0.0"]]), null, new Map());

    Assert.areEqual("version", Assert.throws(() => declaration.accepts("tasks", "^1.0.0"), ArgumentException).parameterName);
    Assert.areEqual("version", Assert.throws(() => declaration.accepts("clock", "1.0"), ArgumentException).parameterName);
  }

  @TestMethod
  public keepsItsOwnCopies(): void {
    const dependencies = new Map([["tasks", "1.0.0"]]);
    const methods = ["notes.list"];
    const contributions = new Map([["methods", methods]]);

    const declaration = new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", dependencies, null, contributions);
    dependencies.set("clock", "0.2.0");
    methods.push("notes.open");
    contributions.set("events", ["notes.changed"]);

    Assert.areEqual("tasks", declaration.dependencies.join(","));
    Assert.areEqual("notes.list", declaration.listContributions("methods").join(","));
    Assert.areEqual(0, declaration.listContributions("events").length);
  }

  @TestMethod
  @TestData("desktop")
  @TestData("Notes")
  @TestData(String.empty)
  public refusesAnInvalidId(id: string): void {
    Assert.throws(() => new ModuleDeclaration(id, "1.2.3", "Notes", "Keeps notes.", new Map(), null, new Map()), ArgumentException);
    Assert.areEqual(
      "A module declaration's id is missing or invalid.",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, id }), DeclarationFieldInvalidException).message);
  }

  @TestMethod
  @TestData("con")
  @TestData("prn")
  @TestData("aux")
  @TestData("nul")
  @TestData("com0")
  @TestData("com1")
  @TestData("com2")
  @TestData("com3")
  @TestData("com4")
  @TestData("com5")
  @TestData("com6")
  @TestData("com7")
  @TestData("com8")
  @TestData("com9")
  @TestData("lpt0")
  @TestData("lpt1")
  @TestData("lpt2")
  @TestData("lpt3")
  @TestData("lpt4")
  @TestData("lpt5")
  @TestData("lpt6")
  @TestData("lpt7")
  @TestData("lpt8")
  @TestData("lpt9")
  public refusesAnIdThatNamesAWindowsDevice(id: string): void {
    const message = `The module id "${id}" names a device on Windows, so it is refused on every platform.`;

    const constructed = Assert.throws(() => new ModuleDeclaration(id, "1.2.3", "Notes", "Keeps notes.", new Map(), null, new Map()), ArgumentException);
    const read = Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, id }), ModuleIdDeviceException);

    Assert.areEqual("id", constructed.parameterName);
    Assert.areEqual(`${message} (Parameter 'id')`, constructed.message);
    Assert.areEqual(message, read.message);
  }

  @TestMethod
  public refusesABlankDisplayNameOrDescription(): void {
    Assert.throws(() => new ModuleDeclaration("notes", "1.2.3", " ", "Keeps notes.", new Map(), null, new Map()), ArgumentException);
    Assert.throws(() => new ModuleDeclaration("notes", "1.2.3", "Notes", " ", new Map(), null, new Map()), ArgumentException);
  }

  @TestMethod
  @TestData("0.0.1")
  @TestData("10.200.3000")
  @TestData("999999999.999999999.999999999")
  public acceptsAVersionOfThreeNumbers(version: string): void {
    Assert.areEqual(version, new ModuleDeclaration("notes", version, "Notes", "Keeps notes.", new Map(), null, new Map()).version);
    Assert.areEqual(version, ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, version }).version);
  }

  @TestMethod
  @TestData(String.empty)
  @TestData("1.2")
  @TestData("1.2.3.4")
  @TestData("01.2.3")
  @TestData("v1.2.3")
  @TestData("1.2.3-beta")
  @TestData("1000000000.0.0")
  public refusesAnInvalidVersion(version: string): void {
    Assert.areEqual("version", Assert.throws(() => new ModuleDeclaration("notes", version, "Notes", "Keeps notes.", new Map(), null, new Map()), ArgumentException).parameterName);
    Assert.areEqual(
      "A module declaration's version is missing or invalid.",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, version }), DeclarationFieldInvalidException).message);
  }

  @TestMethod
  public namesTheFirstMissingOrInvalidField(): void {
    for (const value of [[], null])
      Assert.areEqual("A module declaration is not a JSON object.", Assert.throws(() => ModuleDeclaration.fromJson(value), DeclarationNotObjectException).message);
    const cases: readonly (readonly [unknown, string])[] = [
      [ModuleDeclarationTests.without("id"), "A module declaration's id is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, id: 3 }, "A module declaration's id is missing or invalid."],
      [ModuleDeclarationTests.without("version"), "A module declaration's version is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, version: 1 }, "A module declaration's version is missing or invalid."],
      [ModuleDeclarationTests.without("contributes"), "A module declaration's contributes is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, contributes: [] }, "A module declaration's contributes is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, contributes: { methods: "notes.list" } }, "A module declaration's contributes is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, contributes: { methods: [" "] } }, "A module declaration's contributes is missing or invalid."],
      [ModuleDeclarationTests.without("displayName"), "A module declaration's displayName is missing or invalid."],
      [ModuleDeclarationTests.without("description"), "A module declaration's description is missing or invalid."],
      [ModuleDeclarationTests.without("dependencies"), "A module declaration's dependencies is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, dependencies: [1] }, "A module declaration's dependencies is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, dependencies: ["tasks"] }, "A module declaration's dependencies is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, dependencies: { tasks: 1 } }, "A module declaration's dependencies is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, dependencies: { tasks: "1.x" } }, "A module declaration's dependencies is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, dependencies: { tasks: "^1.0.0" } }, "A module declaration's dependencies is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, dependencies: { tasks: "~1.0.0" } }, "A module declaration's dependencies is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, dependencies: { tasks: ">=1.0.0 <2.0.0" } }, "A module declaration's dependencies is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, dependencies: { tasks: "*" } }, "A module declaration's dependencies is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, dependencies: { " ": "1.0.0" } }, "A module declaration's dependencies is missing or invalid."],
      [ModuleDeclarationTests.without("runtimePackage"), "A module declaration's runtimePackage is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, runtimePackage: String.empty }, "A module declaration's runtimePackage is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, cliPackage: " " }, "A module declaration's cliPackage is missing or invalid."],
      [{ ...ModuleDeclarationTests.VALID, cliCommands: {} }, "A module declaration's cliCommands is missing or invalid."]
    ];
    for (const [value, message] of cases)
      Assert.areEqual(message, Assert.throws(() => ModuleDeclaration.fromJson(value), DeclarationFieldInvalidException).message);
  }

  @TestMethod
  public passesOnAFailureToReadTheValueThatIsNotAboutItsFormat(): void {
    const failure = new RangeError("The value cannot be read.");
    const value = { get id(): string { throw failure; } };

    Assert.areEqual(failure, Assert.throws(() => ModuleDeclaration.fromJson(value), RangeError));
  }

  @TestMethod
  public readsTheSettingsItDeclaresAndRefusesAnotherOwnersOrAnInvalidOne(): void {
    const setting = { name: "notes.sortBy", title: "Sort by", description: "Orders the list.", type: { kind: "Text", maxLength: 20 }, default: "title", locality: "Shared", scopes: [], page: "Notes", group: "List" };

    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [setting] });

    Assert.areEqual("notes.sortBy", declaration.settings.map(t => t.name.text).join(","));
    Assert.areEqual(0, ModuleDeclaration.fromJson(ModuleDeclarationTests.VALID).settings.length);
    Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: {} }), DeclarationFieldInvalidException);
    Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [{ ...setting, default: 1 }] }), DeclarationFieldInvalidException);
    Assert.areEqual("The module notes declares the setting tasks.size, which it does not own. (Parameter 'settings')",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [{ ...setting, name: "tasks.size" }] }), ArgumentException).message);
    Assert.areEqual("The module notes declares the setting notes.keys of the kind KeyBindings, which only the shell declares. (Parameter 'settings')",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [{ ...setting, name: "notes.keys", type: { kind: "KeyBindings" }, default: {} }] }), ArgumentException).message);
    Assert.areEqual("The module notes declares the setting notes.languages of the kind Languages, which only the shell declares. (Parameter 'settings')",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [{ ...setting, name: "notes.languages", type: { kind: "Languages" }, default: [] }] }), ArgumentException).message);
    for (const page of ["Keyboard shortcuts", "About"])
      Assert.areEqual(`The module notes puts the setting notes.sortBy on the page ${page}, which only the shell fills. (Parameter 'settings')`,
        Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [{ ...setting, page }] }), ArgumentException).message);
    Assert.areEqual("Appearance", ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [{ ...setting, page: "Appearance" }] }).settings[0]?.page);
  }

  @TestMethod
  public readsAnActionOfItsOwnCommandAndRefusesOneOfACommandItDoesNotContribute(): void {
    const action = { name: "notes.start", title: "Starting a note", description: "Opens a new note.", type: { kind: "Action", command: "notes.new", label: "Start a note" }, default: null, locality: "Shared", scopes: [], page: "Notes", group: "Writing" };

    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, contributes: { commands: ["notes.new"] }, settings: [action] });

    Assert.areEqual("notes.new", declaration.settings.map(t => t.type.command?.text).join(","));
    Assert.areEqual("The module notes declares the action setting notes.start, whose command notes.new it does not declare. (Parameter 'settings')",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [action] }), ArgumentException).message);
  }

  @TestMethod
  public readsItsWebViewsOrNoneWhenTheyAreLeftOut(): void {
    const webViews = { methods: [{ name: "Page.captureScreenshot", parameters: { quality: { maximum: 100 } } }], events: ["Page.loadEventFired"] };

    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, webViews });

    Assert.areEqual(JSON.stringify({ ...webViews, keys: [] }), JSON.stringify(declaration.webViews?.toJson()));
    Assert.isTrue(declaration.webViews?.allows("Page.captureScreenshot", { quality: 100 }) ?? false);
    Assert.isNull(ModuleDeclaration.fromJson(ModuleDeclarationTests.VALID).webViews);
    Assert.isNull(new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map(), null, new Map()).webViews);
    Assert.areEqual("A module declaration's webViews is missing or invalid.",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, webViews: { methods: [{ name: "Page.navigate" }] } }), DeclarationFieldInvalidException).message);
    Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, webViews: [] }), DeclarationFieldInvalidException);
  }

  @TestMethod
  public readsWhetherItUsesPseudoTerminalsOrNotWhenItIsLeftOut(): void {
    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, pseudoTerminals: true });

    Assert.isTrue(declaration.usesPseudoTerminals);
    Assert.isFalse(ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, pseudoTerminals: false }).usesPseudoTerminals);
    Assert.isFalse(ModuleDeclaration.fromJson(ModuleDeclarationTests.VALID).usesPseudoTerminals);
    Assert.isFalse(new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map(), null, new Map()).usesPseudoTerminals);
    Assert.isTrue(new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map(), null, new Map(), [], null, [], null, true).usesPseudoTerminals);
    for (const value of ["true", 1, null])
      Assert.areEqual("A module declaration's pseudoTerminals is missing or invalid.",
        Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, pseudoTerminals: value }), DeclarationFieldInvalidException).message);
  }

  @TestMethod
  public readsItsSwitchSettingOrNoneWhenItIsLeftOut(): void {
    const setting = { name: "notes.enabled", title: "Notes", description: "Turns notes on.", type: { kind: "Boolean" }, default: true, locality: "Shared", scopes: [], page: "Notes", group: "Notes" };

    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [setting], switchSetting: "notes.enabled" });

    Assert.areEqual("notes.enabled", declaration.switchSetting);
    Assert.isNull(ModuleDeclaration.fromJson(ModuleDeclarationTests.VALID).switchSetting);
    for (const value of [true, " ", null])
      Assert.areEqual("A module declaration's switchSetting is missing or invalid.",
        Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, settings: [setting], switchSetting: value }), DeclarationFieldInvalidException).message);
  }

  @TestMethod
  public readsThePlatformsItRunsOnOrRunsOnEveryPlatformWhenTheyAreLeftOut(): void {
    const platforms = ["windows", "macos"];

    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, platforms });
    platforms.push("linux");

    Assert.areEqual("windows,macos", declaration.platforms?.join(","));
    Assert.areEqual("true,true,false,false", ["win32", "darwin", "linux", "freebsd"].map(t => String(declaration.runsOn(t))).join(","));
    Assert.isNull(ModuleDeclaration.fromJson(ModuleDeclarationTests.VALID).platforms);
    Assert.isTrue(ModuleDeclaration.fromJson(ModuleDeclarationTests.VALID).runsOn("freebsd"));
    for (const value of ["windows", [1], [" "], null])
      Assert.areEqual("A module declaration's platforms is missing or invalid.",
        Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, platforms: value }), DeclarationFieldInvalidException).message);
  }

  @TestMethod
  @TestData(String.empty)
  @TestData("linux,linux")
  @TestData("freebsd")
  @TestData("Windows")
  public refusesPlatformsThatAreEmptyRepeatOneOrNameAnother(names: string): void {
    const platforms = names === String.empty ? [] : names.split(",");

    const failure = Assert.throws(
      () => new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map(), null, new Map(), [], null, [], null, false, new Map(), null, platforms), ArgumentException);

    Assert.areEqual("platforms", failure.parameterName);
    Assert.isTrue(failure.message.startsWith("The module notes must list its platforms once each as windows, macos or linux, with at least one."), failure.message);
  }

  @TestMethod
  public readsTheNoldovaDesktopVersionsItAcceptsAndAcceptsOnlyThoseOrAnyWhenItNamesNone(): void {
    const declaration = ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, noldovaDesktop: ">=0.0.70 <0.1.0" });
    const versions = ["0.0.69", "0.0.70", "0.0.71", "0.0.999", "0.1.0", "1.0.0", "0.0", null];

    Assert.areEqual(">=0.0.70 <0.1.0", declaration.noldovaDesktop);
    Assert.areEqual("false,true,true,true,false,false,false,false", versions.map(t => String(declaration.acceptsNoldovaDesktop(t))).join(","));
    Assert.isNull(ModuleDeclaration.fromJson(ModuleDeclarationTests.VALID).noldovaDesktop);
    Assert.areEqual("true,true", ["0.0.1", null].map(t => String(ModuleDeclaration.fromJson(ModuleDeclarationTests.VALID).acceptsNoldovaDesktop(t))).join(","));
    Assert.areEqual("A module declaration's noldovaDesktop is missing or invalid.",
      Assert.throws(() => ModuleDeclaration.fromJson({ ...ModuleDeclarationTests.VALID, noldovaDesktop: 70 }), DeclarationFieldInvalidException).message);
  }

  @TestMethod
  @TestData("0.0.70")
  @TestData(">=0.0.70")
  @TestData("^0.0.70")
  @TestData(">=0.0.70 <=0.1.0")
  @TestData(">= 0.0.70 <0.1.0")
  @TestData(">=0.0.70 <0.0.70")
  @TestData(">=0.1.0 <0.0.70")
  @TestData(">=0.0.070 <0.1.0")
  public refusesNoldovaDesktopVersionsThatAreNotOneRangeFromALowestVersionBelowAFirstRefusedOne(noldovaDesktop: string): void {
    const failure = Assert.throws(
      () => new ModuleDeclaration("notes", "1.2.3", "Notes", "Keeps notes.", new Map(), null, new Map(), [], null, [], null, false, new Map(), null, null, noldovaDesktop), ArgumentException);

    Assert.areEqual("noldovaDesktop", failure.parameterName);
    Assert.isTrue(failure.message.startsWith("The module notes must name the Noldova Desktop versions it accepts as >=<lowest version> <first version refused>, with the lowest below the first refused."), failure.message);
  }

  private static without(field: string): Readonly<Record<string, unknown>> {
    return Object.fromEntries(Object.entries(ModuleDeclarationTests.VALID).filter(([name]) => name !== field));
  }
}
