/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { ModuleStatusList, QualifiedName, SettingDefinition, SettingKey, SettingLocality, SettingType, SettingValue } from "@noldova/desktop.protocol";
import {
  DataDirectory, type IRuntimePart, type IRuntimePartContext, MethodRegistry, Migration, ModuleActivationException, ModuleDatabase, ModuleDeclaration, ModuleHost, type OwnedProcess, RequestContext,
  SettingsService, type ToolFailure, type ToolResult, ToolRisk, WorkTracker
} from "@noldova/desktop.runtime";

import { EventSinkFixture } from "../../fixtures/event-sink.fixture.js";
import { ModuleHostFixture } from "../../fixtures/module-host.fixture.js";
import { ProgramFixture } from "../../fixtures/program.fixture.js";
import { RuntimePartFixture } from "../../fixtures/runtime-part.fixture.js";
import { SettingsFixture } from "../../fixtures/settings.fixture.js";
import { TemporaryFolderFixture } from "../../fixtures/temporary-folder.fixture.js";
import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";
import { ToolHandlerFixture } from "../../fixtures/tool-handler.fixture.js";

@TestClass
export class ModuleHostTests {
  @TestMethod
  public async activatesEachModuleAfterItsDependenciesAndReportsThemInThatOrder(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const log: string[] = [];
    const store = new Map<string, string>([["first", "Write the plan"]]);
    let found: Map<unknown, unknown> | null = null;
    const parts = new Map<string, IRuntimePart>([
      ["notes-runtime", new RuntimePartFixture("notes", log, t => {
        found = t.getService("tasks.store", Map);
      })],
      ["tasks-runtime", new RuntimePartFixture("tasks", log, t => t.publishService("tasks.store", store))]
    ]);
    const host = ModuleHostFixture.create([
      ModuleHostFixture.declare("notes", ["tasks", "theme"], "notes-runtime"),
      ModuleHostFixture.declare("tasks", [], "tasks-runtime"),
      ModuleHostFixture.declare("theme", [], null)
    ], parts);

    const before = host.report.modules.length;
    await host.activateAsync(settings.service, settings.processes);

    Assert.areEqual(0, before);
    Assert.areEqual("activate tasks,activate notes", log.join(","));
    Assert.areEqual<unknown>(store, found);
    Assert.areEqual("tasks Active,theme Active,notes Active", ModuleHostTests.describe(host));
    Assert.areEqual(
      "{\"id\":\"notes\",\"version\":\"0.0.1\",\"displayName\":\"notes\",\"description\":\"notes\",\"dependencies\":[\"tasks\",\"theme\"],\"contributes\":{\"methods\":[\"notes.run\"]},\"state\":\"Active\"}",
      JSON.stringify(host.report.modules[2]?.toJson()));
  }

  @TestMethod
  public async recordsFailuresWithSafeCausesAndBlocksTheirDependents(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const methods = new MethodRegistry();
    const diagnostics = new TextOutputFixture();
    const log: string[] = [];
    const parts = new Map<string, IRuntimePart | Error>([
      ["broken-runtime", new Error("Cannot find module /home/person/secret/broken.js")],
      ["failing-runtime", new RuntimePartFixture("failing", log, t => {
        t.registerMethod("failing.run", { handleAsync: async () => null });
        throw new Error("at /home/person/secret/failing.js:3");
      })]
    ]);
    const host = ModuleHostFixture.create([
      ModuleHostFixture.declare("broken", [], "broken-runtime"),
      ModuleHostFixture.declare("failing", [], "failing-runtime"),
      ModuleHostFixture.declare("notes", ["broken"], null),
      ModuleHostFixture.declare("orphan", ["missing"], null),
      ModuleHostFixture.declare("first", ["second"], null),
      ModuleHostFixture.declare("second", ["first"], null)
    ], parts, methods, diagnostics);

    await host.activateAsync(settings.service, settings.processes);
    await host.deactivateAsync();
    const written = diagnostics.text;

    Assert.areEqual(
      [
        "broken Failed Its runtime part could not be loaded.",
        "failing Failed Its runtime part failed to activate.",
        "orphan Blocked It depends on missing, which is not active. missing",
        "notes Blocked It depends on broken, which is not active. broken",
        "first Blocked It depends on second, which is not active. second",
        "second Blocked It depends on first, which is not active. first"
      ].join(","),
      ModuleHostTests.describe(host));
    Assert.isUndefined(methods.find(new QualifiedName("failing", "run")));
    Assert.areEqual("activate failing", log.join(","));
    Assert.isTrue(written.startsWith("The module broken 0.0.1: Its runtime part could not be loaded.\nError: Cannot find module /home/person/secret/broken.js\n"), written);
    Assert.isTrue(written.includes("The module failing 0.0.1: Its runtime part failed to activate.\nError: at /home/person/secret/failing.js:3\n"), written);
  }

  @TestMethod
  public async blocksAModuleWhoseDependencyIsAtAnotherVersionAndSaysWhy(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const needing = (id: string, dependency: string, version: string): ModuleDeclaration =>
      new ModuleDeclaration(id, "0.0.1", id, id, new Map([[dependency, version]]), null, new Map());
    const host = ModuleHostFixture.create([
      ModuleHostFixture.declare("tasks", [], null),
      needing("notes", "tasks", "0.0.1"),
      needing("journal", "tasks", "0.0.2"),
      needing("diary", "journal", "0.0.1")
    ], new Map());

    await host.activateAsync(settings.service, settings.processes);

    Assert.areEqual(
      [
        "tasks Active",
        "notes Active",
        "journal Blocked It depends on tasks 0.0.2, and the app has tasks 0.0.1. tasks",
        "diary Blocked It depends on journal, which is not active. journal"
      ].join(","),
      ModuleHostTests.describe(host));
  }

  @TestMethod
  public async activatesAModuleAfterItsPresentOptionalDependenciesAndRunsItWithoutTheOthersSayingWhy(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    const log: string[] = [];
    const zones = new Map<string, string>([["home", "Europe/Paris"]]);
    const found: unknown[] = [];
    const isMap = (t: object): t is Map<unknown, unknown> => t instanceof Map;
    const parts = new Map<string, IRuntimePart | Error>([
      ["notes-runtime", new RuntimePartFixture("notes", log, t => {
        found.push(t.findService("clock.zones", isMap), t.findService("theme.colors", isMap));
      })],
      ["clock-runtime", new RuntimePartFixture("clock", log, t => t.publishService("clock.zones", zones))],
      ["theme-runtime", new RuntimePartFixture("theme", log, t => t.publishService("theme.colors", new Map()))],
      ["broken-runtime", new Error("Cannot find module broken.js")]
    ]);
    const host = ModuleHostFixture.create([
      new ModuleDeclaration(
        "notes", "0.0.1", "notes", "notes", new Map(), "notes-runtime", new Map(), [], null, [], null, false,
        new Map([["clock", "0.0.1"], ["tasks", "0.0.1"], ["broken", "0.0.1"], ["orphan", "0.0.1"], ["theme", "0.0.2"]])),
      ModuleHostFixture.declare("clock", [], "clock-runtime"),
      ModuleHostFixture.declare("broken", [], "broken-runtime"),
      ModuleHostFixture.declare("orphan", ["missing"], null),
      ModuleHostFixture.declare("theme", [], "theme-runtime")
    ], parts, undefined, diagnostics);

    await host.activateAsync(settings.service, settings.processes);
    const written = diagnostics.text;

    Assert.areEqual("activate clock,activate theme,activate notes", log.join(","));
    Assert.areEqual<unknown>(zones, found[0]);
    Assert.isNull(found[1]);
    Assert.areEqual(
      "clock Active,broken Failed Its runtime part could not be loaded.,orphan Blocked It depends on missing, which is not active. missing,theme Active,notes Active",
      ModuleHostTests.describe(host));
    Assert.areEqual("clock,tasks,broken,orphan,theme", host.report.modules.at(-1)?.optionalDependencies.join(","));
    Assert.isTrue(written.includes(
      [
        "The module notes 0.0.1 runs without its optional dependency tasks: the app doesn't include it.",
        "The module notes 0.0.1 runs without its optional dependency broken: it is failed.",
        "The module notes 0.0.1 runs without its optional dependency orphan: it is blocked.",
        "The module notes 0.0.1 runs without its optional dependency theme: it needs theme 0.0.2, and the app has theme 0.0.1.\n"
      ].join("\n")), written);
    Assert.isFalse(written.includes("optional dependency clock"), written);
  }

  @TestMethod
  public async endsTheProgramsOfAPartThatFailsToActivateOrDeactivates(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const log: string[] = [];
    const started: Promise<OwnedProcess>[] = [];
    const start = (context: IRuntimePartContext): void => {
      started.push(context.startProcessAsync(ProgramFixture.request(folder.path, [ProgramFixture.WAIT])));
    };
    const parts = new Map<string, IRuntimePart>([
      ["failing-runtime", new RuntimePartFixture("failing", log, t => {
        start(t);
        throw new Error("The failing part gave up.");
      })],
      ["notes-runtime", new RuntimePartFixture("notes", log, start)]
    ]);
    const host = ModuleHostFixture.create([
      ModuleHostFixture.declare("failing", [], "failing-runtime"),
      ModuleHostFixture.declare("notes", [], "notes-runtime")
    ], parts);

    await host.activateAsync(settings.service, settings.processes);
    const [failed, notes] = await Promise.all(started);
    const runningAfterActivation = settings.processes.programs.map(t => t.moduleId).join(",");
    const failedEnded = failed?.hasExited === true;
    await host.deactivateAsync();

    Assert.areEqual("notes", runningAfterActivation);
    Assert.isTrue(failedEnded);
    Assert.isTrue(notes?.hasExited === true);
    Assert.areEqual(0, settings.processes.programs.length);
  }

  @TestMethod
  public async endsTheProgramsOfEveryPartTogetherWhenTheyDeactivate(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const started: Promise<OwnedProcess>[] = [];
    const start = (context: IRuntimePartContext): void => {
      started.push(context.startProcessAsync(ProgramFixture.request(folder.path, [ProgramFixture.STUBBORN])));
    };
    const parts = new Map<string, IRuntimePart>([
      ["tasks-runtime", new RuntimePartFixture("tasks", [], start)],
      ["notes-runtime", new RuntimePartFixture("notes", [], start)]
    ]);
    const host = ModuleHostFixture.create([
      ModuleHostFixture.declare("tasks", [], "tasks-runtime"),
      ModuleHostFixture.declare("notes", ["tasks"], "notes-runtime")
    ], parts);
    await host.activateAsync(settings.service, settings.processes);
    const programs = await Promise.all(started);
    await Promise.all(programs.map(t => ProgramFixture.readLineAsync(t)));
    const stops: string[] = [];
    const stopOwnedByAsync = settings.processes.stopOwnedByAsync.bind(settings.processes);
    settings.processes.stopOwnedByAsync = async (moduleId: string): Promise<void> => {
      stops.push(`stop ${moduleId}`);
      await stopOwnedByAsync(moduleId);
      stops.push(`stopped ${moduleId}`);
    };

    await host.deactivateAsync();

    Assert.areEqual("stop notes,stop tasks", stops.slice(0, 2).join(","));
    Assert.areEqual(4, stops.length);
    Assert.isTrue(programs.every(t => t.hasExited));
    Assert.areEqual(0, settings.processes.programs.length);
  }

  @TestMethod
  public async reportsAFailedStopWithTheOthersAfterEveryPartsProgramsEnded(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const started: Promise<OwnedProcess>[] = [];
    const start = (context: IRuntimePartContext): void => {
      started.push(context.startProcessAsync(ProgramFixture.request(folder.path, [ProgramFixture.WAIT])));
    };
    const parts = new Map<string, IRuntimePart>([
      ["tasks-runtime", new RuntimePartFixture("tasks", [], start)],
      ["notes-runtime", new RuntimePartFixture("notes", [], start)]
    ]);
    const host = ModuleHostFixture.create([
      ModuleHostFixture.declare("tasks", [], "tasks-runtime"),
      ModuleHostFixture.declare("notes", ["tasks"], "notes-runtime")
    ], parts);
    await host.activateAsync(settings.service, settings.processes);
    const programs = await Promise.all(started);
    const failure = new Error("The notes' programs could not be checked.");
    const stopOwnedByAsync = settings.processes.stopOwnedByAsync.bind(settings.processes);
    settings.processes.stopOwnedByAsync = async (moduleId: string): Promise<void> => {
      await stopOwnedByAsync(moduleId);
      if (moduleId === "notes")
        throw failure;
    };

    const exception = await Assert.throwsAsync(() => host.deactivateAsync(), AggregateError);

    Assert.areEqual("One or more runtime parts failed to deactivate.", exception.message);
    Assert.areEqual<unknown>(failure, exception.errors[0]);
    Assert.areEqual(1, exception.errors.length);
    Assert.isTrue(programs.every(t => t.hasExited));
    Assert.areEqual(0, settings.processes.programs.length);
  }

  @TestMethod
  public async takesNoNewToolCallOnceAPartsDeactivationStarts(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const handler = new ToolHandlerFixture();
    const outcomes: (ToolResult | ToolFailure)[] = [];
    let callAsync = (): Promise<ToolResult | ToolFailure> => Promise.reject(new Error("No session is open."));
    const part: IRuntimePart = {
      activateAsync: async context => {
        context.tools.register({
          name: "notes_search", description: "Searches the notes.", inputSchema: { type: "object" }, hints: { isReadOnly: true },
          risk: { default: ToolRisk.Low, maximum: ToolRisk.Low }, deadline: { default: 2_000, maximum: 5_000 }
        }, handler);
      },
      deactivateAsync: async () => {
        outcomes.push(await callAsync());
      }
    };
    const declaration = new ModuleDeclaration("notes", "0.0.1", "notes", "notes", new Map(), "notes-runtime", new Map([["tools", ["notes_search"]]]));
    const host = ModuleHostFixture.create([declaration], new Map([["notes-runtime", part]]));
    await host.activateAsync(settings.service, settings.processes);
    const session = host.tools.openSession("conversation-1", {});
    callAsync = () => session.callAsync("notes_search", {});
    outcomes.push(await callAsync());

    await host.deactivateAsync();
    session.end();

    Assert.areEqual(JSON.stringify([false, true]), JSON.stringify(outcomes.map(t => t.isFailure)));
    Assert.areEqual("The tool notes_search is not available while its module turns off.", outcomes[1]?.isFailure === true ? outcomes[1].message : null);
    Assert.areEqual(1, handler.calls.length);
  }

  @TestMethod
  public async deactivatesInReverseOrderAndWithdrawsEvenWhenAPartFails(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const methods = new MethodRegistry();
    const log: string[] = [];
    const failure = new Error("The notes cannot be saved.");
    const diagnostics = new TextOutputFixture();
    const parts = new Map<string, IRuntimePart>([
      ["tasks-runtime", new RuntimePartFixture("tasks", log, t => t.registerMethod("tasks.list", { handleAsync: async () => [] }))],
      ["notes-runtime", new RuntimePartFixture("notes", log, t => t.registerMethod("notes.list", { handleAsync: async () => [] }), failure)]
    ]);
    const host = ModuleHostFixture.create([
      ModuleHostFixture.declare("tasks", [], "tasks-runtime", ["tasks.list"]),
      ModuleHostFixture.declare("notes", ["tasks"], "notes-runtime", ["notes.list"])
    ], parts, methods, diagnostics);
    await host.activateAsync(settings.service, settings.processes);

    const exception = await Assert.throwsAsync(() => host.deactivateAsync(), AggregateError);
    await host.deactivateAsync();

    Assert.areEqual("activate tasks,activate notes,deactivate notes,deactivate tasks", log.join(","));
    Assert.areEqual("One or more runtime parts failed to deactivate.", exception.message);
    Assert.areEqual<unknown>(failure, exception.errors[0]);
    Assert.isUndefined(methods.find(new QualifiedName("notes", "list")));
    Assert.isUndefined(methods.find(new QualifiedName("tasks", "list")));
    Assert.isTrue(diagnostics.text.startsWith("The module notes 0.0.1: Its runtime part failed to deactivate.\nError: The notes cannot be saved.\n"));
  }

  @TestMethod
  public async failsAModuleWhoseDatabaseCannotBeMigratedOrIsNewerWithoutActivatingIt(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const directory = new DataDirectory(folder.path);
    (await ModuleDatabase.openAsync(directory, "newer", [
      new Migration("create-items", ["CREATE TABLE items (name TEXT) STRICT"]),
      new Migration("create-tags", ["CREATE TABLE tags (name TEXT) STRICT"])
    ])).close();
    const log: string[] = [];
    const diagnostics = new TextOutputFixture();
    const parts = new Map<string, IRuntimePart>([
      ["broken-runtime", new RuntimePartFixture("broken", log, () => undefined, null, [new Migration("create-broken", ["INSERT INTO missing VALUES (1)"])])],
      ["newer-runtime", new RuntimePartFixture("newer", log, () => undefined, null, [new Migration("create-items", ["CREATE TABLE items (name TEXT) STRICT"])])]
    ]);
    const host = ModuleHostFixture.create([
      ModuleHostFixture.declare("broken", [], "broken-runtime"),
      ModuleHostFixture.declare("newer", [], "newer-runtime")
    ], parts, new MethodRegistry(), diagnostics, folder.path);

    await host.activateAsync(settings.service, settings.processes);

    Assert.areEqual(String.empty, log.join(","));
    Assert.areEqual(
      "broken Failed Its database could not be opened or migrated.," +
      "newer Failed Its database was written by a newer build or is not one this build recognizes.",
      ModuleHostTests.describe(host));
    Assert.isTrue(diagnostics.text.includes("The migration create-broken of the database of the module broken failed and was rolled back."));
    using kept = await ModuleDatabase.openAsync(directory, "newer", [
      new Migration("create-items", ["CREATE TABLE items (name TEXT) STRICT"]),
      new Migration("create-tags", ["CREATE TABLE tags (name TEXT) STRICT"])
    ]);
    Assert.areEqual("create-items,create-tags", kept.appliedMigrations.join(","));
  }

  @TestMethod
  public async closesTheDatabaseOfAPartThatFailsToActivate(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    await using folder = await TemporaryFolderFixture.createAsync();
    const migrations = [new Migration("create-notes", ["CREATE TABLE notes (title TEXT NOT NULL) STRICT"])];
    const part = new RuntimePartFixture("notes", [], t => {
      t.database.run("INSERT INTO notes (title) VALUES (?)", "Plan");
      throw new Error("activation failed");
    }, null, migrations);
    const host = ModuleHostFixture.create([ModuleHostFixture.declare("notes", [], "notes-runtime")], new Map<string, IRuntimePart>([["notes-runtime", part]]),
      new MethodRegistry(), new TextOutputFixture(), folder.path);

    await host.activateAsync(settings.service, settings.processes);
    const database = part.context?.database;

    Assert.areEqual("Failed", host.report.modules[0]?.state);
    Assert.throws(() => database?.readAll("SELECT title FROM notes"), Error);
  }

  @TestMethod
  public async givesPartsTheLogAndTheWorkAndEndsAModulesWorkWhenItDeactivatesOrFailsToActivate(): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const diagnostics = new TextOutputFixture();
    let changes = 0;
    const work = new WorkTracker(() => changes++);
    const signals: AbortSignal[] = [];
    const parts = new Map<string, IRuntimePart>([
      ["notes-runtime", new RuntimePartFixture("notes", [], t => {
        t.log.write(`Opened ${path.resolve("home", "person", "notes")}`);
        signals.push(t.beginWork("Saving the notes").signal);
      })],
      ["failing-runtime", new RuntimePartFixture("failing", [], t => {
        signals.push(t.beginWork("Starting up").signal);
        throw new Error("activation failed");
      })]
    ]);
    const host = ModuleHostFixture.create(
      [ModuleHostFixture.declare("notes", [], "notes-runtime"), ModuleHostFixture.declare("failing", [], "failing-runtime")],
      parts, new MethodRegistry(), diagnostics, path.resolve("noldova-desktop-data"), work);

    await host.activateAsync(settings.service, settings.processes);
    const active = work.descriptions.join(",");
    const failedAborted = signals[1]?.aborted === true;
    await host.deactivateAsync();

    Assert.areEqual("Saving the notes", active);
    Assert.isTrue(failedAborted);
    Assert.isTrue(signals[0]?.aborted === true);
    Assert.isTrue(work.isEmpty);
    Assert.areEqual(4, changes);
    Assert.isTrue(diagnostics.text.startsWith(`notes: Opened ${path.join("~", "notes")}\n`), diagnostics.text);
  }

  private static describe(host: ModuleHost): string {
    return host.report.modules.map(t => [t.id, t.state, t.cause, t.blockedBy].filter(u => !Object.isNull(u)).join(" ")).join(",");
  }
}

@TestClass
export class ModuleActivationCauseTests {
  @TestMethod
  public async showsThePartsOwnCauseAndLogsItWithTheError(): Promise<void> {
    await ModuleActivationCauseTests.verifyAsync(
      () => new ModuleActivationException("It runs on Windows and macOS.", { cause: new Error("No backend at /home/person/secret/backend.js") }),
      "It runs on Windows and macOS.",
      ["The module screen 0.0.1: It runs on Windows and macOS.\n", "No backend at /home/person/secret/backend.js"]);
  }

  @TestMethod
  public async keepsTheBasesCauseForAnErrorOfAnotherCopyWithTheSameName(): Promise<void> {
    await ModuleActivationCauseTests.verifyAsync(
      () => Object.assign(new Error("It runs at /home/person/secret/backend.js"), { name: "ModuleActivationException" }),
      "Its runtime part failed to activate.",
      ["The module screen 0.0.1: Its runtime part failed to activate.\n", "It runs at /home/person/secret/backend.js"]);
  }

  @TestMethod
  public async keepsTheBasesCauseWhenTheExceptionsMessageIsBlankOrNotTextOnceThrownAndGoesOnToTheModulesAfterIt(): Promise<void> {
    for (const message of [" ", 7])
      await ModuleActivationCauseTests.verifyAsync(
        () => Object.assign(new ModuleActivationException("It runs on Windows and macOS."), { message }),
        "Its runtime part failed to activate.",
        ["The module screen 0.0.1: Its runtime part failed to activate.\n"]);
  }

  private static async verifyAsync(error: () => Error, cause: string, logged: readonly string[]): Promise<void> {
    await using settings = await SettingsFixture.createAsync();
    const methods = new MethodRegistry();
    const diagnostics = new TextOutputFixture();
    const log: string[] = [];
    const parts = new Map<string, IRuntimePart | Error>([
      ["screen-runtime", new RuntimePartFixture("screen", log, t => {
        t.registerMethod("screen.run", { handleAsync: async () => null });
        throw error();
      })]
    ]);
    const host = ModuleHostFixture.create([
      ModuleHostFixture.declare("screen", [], "screen-runtime"),
      ModuleHostFixture.declare("pointer", ["screen"], null)
    ], parts, methods, diagnostics);

    await host.activateAsync(settings.service, settings.processes);
    await host.deactivateAsync();
    const written = diagnostics.text;

    Assert.areEqual(`screen Failed ${cause},pointer Blocked It depends on screen, which is not active. screen`, ModuleActivationCauseTests.describe(host));
    Assert.areEqual("activate screen", log.join(","));
    Assert.isTrue(logged.every(t => written.includes(t)), written);
  }

  private static describe(host: ModuleHost): string {
    return host.report.modules.map(t => [t.id, t.state, t.cause, t.blockedBy].filter(u => !Object.isNull(u)).join(" ")).join(",");
  }
}

@TestClass
export class ModuleNoldovaDesktopTests {
  @TestMethod
  @TestData("0.0.69", "Noldova Desktop 0.0.69")
  @TestData("0.1.0", "Noldova Desktop 0.1.0")
  @TestData(String.empty, "no Noldova Desktop version in its module declarations")
  public async failsAModuleOutsideTheNoldovaDesktopVersionsItAcceptsBeforeAnyOfItsCodeRunsAndBlocksThoseThatDependOnIt(noldovaDesktop: string, named: string): Promise<void> {
    const log: string[] = [];
    const diagnostics = new TextOutputFixture();
    const host = ModuleNoldovaDesktopTests.create(log, diagnostics, noldovaDesktop === String.empty ? null : noldovaDesktop);
    await using settings = await SettingsFixture.createAsync(host.settingDefinitions);

    await host.activateAsync(settings.service, settings.processes);

    Assert.areEqual(
      `clock Failed It accepts Noldova Desktop >=0.0.70 <0.1.0, but this app has ${named}.,notes Active,tasks Blocked It depends on clock, which is not active. clock`,
      ModuleNoldovaDesktopTests.describe(host));
    Assert.areEqual("activate notes", log.join(","));
    Assert.areEqual(`The module clock 0.0.1 doesn't start: It accepts Noldova Desktop >=0.0.70 <0.1.0, but this app has ${named}.\n`, diagnostics.text);
    await host.deactivateAsync();
  }

  @TestMethod
  @TestData("0.0.70")
  @TestData("0.0.99")
  public async runsAModuleWithinTheNoldovaDesktopVersionsItAccepts(noldovaDesktop: string): Promise<void> {
    const log: string[] = [];
    const host = ModuleNoldovaDesktopTests.create(log, new TextOutputFixture(), noldovaDesktop);
    await using settings = await SettingsFixture.createAsync(host.settingDefinitions);

    await host.activateAsync(settings.service, settings.processes);

    Assert.areEqual("clock Active,notes Active,tasks Active", ModuleNoldovaDesktopTests.describe(host));
    Assert.areEqual("activate clock,activate notes,activate tasks", log.join(","));
    await host.deactivateAsync();
  }

  private static create(log: string[], diagnostics: TextOutputFixture, noldovaDesktop: string | null): ModuleHost {
    return ModuleHostFixture.create([
      new ModuleDeclaration("clock", "0.0.1", "clock", "clock", new Map(), "clock-runtime", new Map([["methods", ["clock.run"]]]), [], null, [], null, false, new Map(), null, null, ">=0.0.70 <0.1.0"),
      ModuleHostFixture.declare("tasks", ["clock"], "tasks-runtime"),
      ModuleHostFixture.declare("notes", [], "notes-runtime")
    ], new Map<string, IRuntimePart>([
      ["clock-runtime", new RuntimePartFixture("clock", log)],
      ["tasks-runtime", new RuntimePartFixture("tasks", log)],
      ["notes-runtime", new RuntimePartFixture("notes", log)]
    ]), new MethodRegistry(), diagnostics, path.resolve("noldova-desktop-data"), new WorkTracker(() => undefined), new EventSinkFixture(), process.platform, noldovaDesktop);
  }

  private static describe(host: ModuleHost): string {
    return host.report.modules.map(t => [t.id, t.state, t.cause, t.blockedBy].filter(u => !Object.isNull(u)).join(" ")).join(",");
  }
}

@TestClass
export class ModulePlatformsTests {
  private static readonly SWITCH: string = "clock.enabled";

  @TestMethod
  public async startsNoPartOfAModuleOnAPlatformItDoesntNameAndOffersNoneOfItsSettings(): Promise<void> {
    const log: string[] = [];
    const host = ModulePlatformsTests.create(log, "linux");
    await using settings = await SettingsFixture.createAsync(host.settingDefinitions);

    await host.activateAsync(settings.service, settings.processes);

    Assert.areEqual(
      "clock Unavailable It doesn't run on Linux.,tasks Blocked It depends on clock, which doesn't run on Linux. clock,notes Active",
      ModulePlatformsTests.describe(host));
    Assert.areEqual("activate notes", log.join(","));
    Assert.areEqual("notes.mode", host.settingDefinitions.map(t => t.name.text).join(","));
    Assert.areEqual(
      "{\"id\":\"clock\",\"version\":\"0.0.1\",\"displayName\":\"clock\",\"description\":\"clock\",\"dependencies\":[],\"contributes\":{\"methods\":[\"clock.run\"],\"settings\":[\"clock.enabled\"]},\"state\":\"Unavailable\",\"cause\":\"It doesn't run on Linux.\"}",
      JSON.stringify(host.report.modules[0]?.toJson()));
    await host.deactivateAsync();
  }

  @TestMethod
  public async runsAModuleOnAPlatformItNamesWithItsSettings(): Promise<void> {
    const log: string[] = [];
    const host = ModulePlatformsTests.create(log, "darwin");
    await using settings = await SettingsFixture.createAsync(host.settingDefinitions);

    await host.activateAsync(settings.service, settings.processes);

    Assert.areEqual("clock Active clock.enabled,tasks Active,notes Active", ModulePlatformsTests.describe(host));
    Assert.areEqual("activate clock,activate tasks,activate notes", log.join(","));
    Assert.areEqual("clock.enabled,notes.mode", host.settingDefinitions.map(t => t.name.text).join(","));
    await host.deactivateAsync();
  }

  @TestMethod
  public async saysThisPlatformOnAPlatformWithoutANameAndRunsAModuleThatNamesNone(): Promise<void> {
    const log: string[] = [];
    const host = ModulePlatformsTests.create(log, "freebsd");
    await using settings = await SettingsFixture.createAsync(host.settingDefinitions);

    await host.activateAsync(settings.service, settings.processes);

    Assert.areEqual(
      "clock Unavailable It doesn't run on this platform.,tasks Blocked It depends on clock, which doesn't run on this platform. clock,notes Active",
      ModulePlatformsTests.describe(host));
    await host.deactivateAsync();
  }

  @TestMethod
  public async keepsAStoredSwitchValueThroughARunWhereTheModuleIsUnavailableAndReadsItBackWhereItRuns(): Promise<void> {
    const log: string[] = [];
    const runs = ModulePlatformsTests.create(log, "darwin");
    await using settings = await SettingsFixture.createAsync(runs.settingDefinitions);
    const key = new SettingKey(QualifiedName.parse(ModulePlatformsTests.SWITCH));
    settings.service.write(new SettingValue(key, false));
    const unavailable = ModulePlatformsTests.create(log, "linux");
    const unavailableSettings = new SettingsService(settings.database, unavailable.settingDefinitions, settings.diagnostics);
    const again = ModulePlatformsTests.create(log, "darwin");

    try {
      await unavailable.activateAsync(unavailableSettings, settings.processes);
      await unavailable.deactivateAsync();
      await again.activateAsync(new SettingsService(settings.database, again.settingDefinitions, settings.diagnostics), settings.processes);

      Assert.areEqual("clock Unavailable It doesn't run on Linux.", ModulePlatformsTests.describe(unavailable).split(",")[0]);
      Assert.areEqual("clock Off clock.enabled", ModulePlatformsTests.describe(again).split(",")[0]);
      Assert.areEqual(false, new SettingsService(settings.database, again.settingDefinitions, settings.diagnostics).read(key));
    }
    finally {
      await unavailable.deactivateAsync();
      await again.deactivateAsync();
    }
  }

  private static create(log: string[], platform: string): ModuleHost {
    return ModuleHostFixture.create([
      new ModuleDeclaration("clock", "0.0.1", "clock", "clock", new Map(), "clock-runtime", new Map([["methods", ["clock.run"]], ["settings", [ModulePlatformsTests.SWITCH]]]),
        [ModulePlatformsTests.define(ModulePlatformsTests.SWITCH)], null, [], null, false, new Map(), ModulePlatformsTests.SWITCH, ["windows", "macos"]),
      ModuleHostFixture.declare("tasks", ["clock"], "tasks-runtime"),
      new ModuleDeclaration("notes", "0.0.1", "notes", "notes", new Map(), "notes-runtime", new Map([["methods", ["notes.run"]], ["settings", ["notes.mode"]]]),
        [ModulePlatformsTests.define("notes.mode")], null, [], null, false, new Map([["clock", "0.0.1"]]))
    ], new Map<string, IRuntimePart>([
      ["clock-runtime", new RuntimePartFixture("clock", log)],
      ["tasks-runtime", new RuntimePartFixture("tasks", log)],
      ["notes-runtime", new RuntimePartFixture("notes", log)]
    ]), new MethodRegistry(), new TextOutputFixture(), path.resolve("noldova-desktop-data"), new WorkTracker(() => undefined), new EventSinkFixture(), platform);
  }

  private static define(name: string): SettingDefinition {
    return new SettingDefinition(QualifiedName.parse(name), "Setting", "A setting.", SettingType.boolean(), true, SettingLocality.Shared, [], "Page", "Group");
  }

  private static describe(host: ModuleHost): string {
    return host.report.modules.map(t => [t.id, t.state, t.cause, t.blockedBy, t.switchSetting].filter(u => !Object.isNull(u)).join(" ")).join(",");
  }
}

@TestClass
export class ModuleSwitchTests {
  private static readonly SWITCH: string = "clock.enabled";

  @TestMethod
  public async startsAModuleWhoseSwitchIsFalseOffWithItsDependentsBlockedAndItsOptionalDependentsRunningWithoutIt(): Promise<void> {
    await using settings = await SettingsFixture.createAsync([ModuleSwitchTests.define(false)]);
    const log: string[] = [];
    const host = ModuleSwitchTests.create(log, []);

    await host.activateAsync(settings.service, settings.processes);

    Assert.areEqual(
      "clock Off clock.enabled,theme Active,tasks Blocked It depends on clock, which is off. clock,notes Active",
      ModuleSwitchTests.describe(host));
    Assert.areEqual("activate theme,activate notes", log.join(","));
    Assert.areEqual(
      "{\"id\":\"clock\",\"version\":\"0.0.1\",\"displayName\":\"clock\",\"description\":\"clock\",\"dependencies\":[],\"contributes\":{\"methods\":[\"clock.run\"],\"settings\":[\"clock.enabled\"]},\"state\":\"Off\",\"switchSetting\":\"clock.enabled\"}",
      JSON.stringify(host.report.modules[0]?.toJson()));
    await host.deactivateAsync();
  }

  @TestMethod
  public async turnsAModuleOffAfterItsDependentsAndOnBeforeThemWithoutRestartingAnyOtherModule(): Promise<void> {
    await using settings = await SettingsFixture.createAsync([ModuleSwitchTests.define(true)]);
    const log: string[] = [];
    const heard: string[] = [];
    const methods = new MethodRegistry();
    const events = new EventSinkFixture();
    const host = ModuleSwitchTests.create(log, heard, methods, events);
    await host.activateAsync(settings.service, settings.processes);
    log.splice(0);

    ModuleSwitchTests.write(settings, false);
    await host.switching;
    const off = ModuleSwitchTests.describe(host);
    const offLog = log.splice(0).join(",");
    const offMethods = ["clock.run", "tasks.run", "theme.run"].filter(t => !Object.isUndefined(methods.find(QualifiedName.parse(t)))).join(",");
    ModuleSwitchTests.write(settings, true);
    await host.switching;

    Assert.areEqual("clock Off clock.enabled,theme Active,tasks Blocked It depends on clock, which is off. clock,notes Active", off);
    Assert.areEqual("deactivate tasks,deactivate clock", offLog);
    Assert.areEqual("theme.run", offMethods);
    Assert.areEqual("activate clock,activate tasks", log.join(","));
    Assert.areEqual("clock Active clock.enabled,theme Active,tasks Active,notes Active", ModuleSwitchTests.describe(host));
    Assert.areEqual("clock false,clock true", heard.join(","));
    const changes = events.broadcasts.filter(t => t.name.text === "desktop.modulesChanged").map(t => ModuleStatusList.fromJson(t.payload).modules.map(u => u.state).join(" "));
    Assert.areEqual("Off Active Blocked Active,Active Active Active Active", changes.join(","));
    await host.deactivateAsync();
  }

  @TestMethod
  public async leavesTheModulesAsTheyAreForAWriteOrResetThatKeepsItsState(): Promise<void> {
    await using settings = await SettingsFixture.createAsync([ModuleSwitchTests.define(true)]);
    const log: string[] = [];
    const events = new EventSinkFixture();
    const host = ModuleSwitchTests.create(log, [], new MethodRegistry(), events);
    await host.activateAsync(settings.service, settings.processes);
    log.splice(0);

    ModuleSwitchTests.write(settings, true);
    settings.service.reset(new SettingKey(QualifiedName.parse(ModuleSwitchTests.SWITCH)));
    await host.switching;

    Assert.areEqual(0, log.length);
    Assert.areEqual(0, events.broadcasts.filter(t => t.name.text === "desktop.modulesChanged").length);
    await host.deactivateAsync();
  }

  @TestMethod
  public async abortsAMethodCallInFlightToAModuleItTurnsOff(): Promise<void> {
    await using settings = await SettingsFixture.createAsync([ModuleSwitchTests.define(true)]);
    const methods = new MethodRegistry();
    const host = ModuleHostFixture.create([ModuleSwitchTests.declare("clock", [], ModuleSwitchTests.SWITCH)], new Map<string, IRuntimePart>([
      ["clock-runtime", new RuntimePartFixture("clock", [], t => t.registerMethod("clock.run", {
        handleAsync: u => new Promise(resolve => u.signal.addEventListener("abort", () => resolve("aborted")))
      }))]
    ]), methods);
    await host.activateAsync(settings.service, settings.processes);
    const caller = new AbortController();
    const call = methods.find(QualifiedName.parse("clock.run"))?.handleAsync(new RequestContext("test", null, caller.signal, 1));

    ModuleSwitchTests.write(settings, false);
    await host.switching;

    Assert.areEqual("aborted", await call);
    Assert.isFalse(caller.signal.aborted);
    await host.deactivateAsync();
  }

  @TestMethod
  public async leavesAModuleThatFailsToTurnOnFailedWithItsDependentsBlockedByIt(): Promise<void> {
    await using settings = await SettingsFixture.createAsync([ModuleSwitchTests.define(false)]);
    const log: string[] = [];
    const diagnostics = new TextOutputFixture();
    const host = ModuleHostFixture.create([
      ModuleSwitchTests.declare("clock", [], ModuleSwitchTests.SWITCH),
      ModuleHostFixture.declare("tasks", ["clock"], "tasks-runtime")
    ], new Map<string, IRuntimePart>([
      ["clock-runtime", new RuntimePartFixture("clock", log, () => {
        throw new Error("The clock could not start.");
      })],
      ["tasks-runtime", new RuntimePartFixture("tasks", log)]
    ]), new MethodRegistry(), diagnostics);
    await host.activateAsync(settings.service, settings.processes);

    ModuleSwitchTests.write(settings, true);
    await host.switching;

    Assert.areEqual(
      "clock Failed Its runtime part failed to activate. clock.enabled,tasks Blocked It depends on clock, which is not active. clock",
      ModuleSwitchTests.describe(host));
    Assert.areEqual("activate clock", log.join(","));
    Assert.isTrue(diagnostics.text.includes("The clock could not start."), diagnostics.text);
    await host.deactivateAsync();
  }

  @TestMethod
  public async keepsADependentBlockedWhileAnotherOfItsDependenciesIsNotActive(): Promise<void> {
    await using settings = await SettingsFixture.createAsync([ModuleSwitchTests.define(false)]);
    const log: string[] = [];
    const host = ModuleHostFixture.create([
      ModuleSwitchTests.declare("clock", [], ModuleSwitchTests.SWITCH),
      ModuleHostFixture.declare("tasks", ["clock", "calendar"], "tasks-runtime")
    ], new Map<string, IRuntimePart>([
      ["clock-runtime", new RuntimePartFixture("clock", log)],
      ["tasks-runtime", new RuntimePartFixture("tasks", log)]
    ]));
    await host.activateAsync(settings.service, settings.processes);

    ModuleSwitchTests.write(settings, true);
    await host.switching;

    Assert.areEqual("clock Active clock.enabled,tasks Blocked It depends on calendar, which is not active. calendar", ModuleSwitchTests.describe(host));
    Assert.areEqual("activate clock", log.join(","));
    await host.deactivateAsync();
  }

  @TestMethod
  public async turnsOffAModuleWhosePartFailsToStopAndBlocksAgainOnlyTheDependentsThatItsChainBlocked(): Promise<void> {
    await using settings = await SettingsFixture.createAsync([ModuleSwitchTests.define(true)]);
    const log: string[] = [];
    const diagnostics = new TextOutputFixture();
    const events = new EventSinkFixture();
    const host = ModuleHostFixture.create([
      ModuleSwitchTests.declare("clock", [], ModuleSwitchTests.SWITCH),
      ModuleHostFixture.declare("tasks", ["clock"], "tasks-runtime"),
      ModuleHostFixture.declare("notes", ["calendar", "clock"], "notes-runtime"),
      ModuleHostFixture.declare("alarm", ["tasks"], "alarm-runtime")
    ], new Map<string, IRuntimePart>([
      ["clock-runtime", new RuntimePartFixture("clock", log, () => undefined, new Error("The clock would not stop."))],
      ["tasks-runtime", new RuntimePartFixture("tasks", log, () => {
        throw new Error("The tasks could not start.");
      })],
      ["notes-runtime", new RuntimePartFixture("notes", log)],
      ["alarm-runtime", new RuntimePartFixture("alarm", log)]
    ]), new MethodRegistry(), diagnostics, path.resolve("noldova-desktop-data"), new WorkTracker(() => undefined), events);
    await host.activateAsync(settings.service, settings.processes);

    ModuleSwitchTests.write(settings, false);
    await host.switching;

    Assert.areEqual([
      "clock Off clock.enabled",
      "tasks Failed Its runtime part failed to activate.",
      "notes Blocked It depends on calendar, which is not active. calendar",
      "alarm Blocked It depends on tasks, which is not active. tasks"
    ].join(","), ModuleSwitchTests.describe(host));
    Assert.areEqual("activate clock,activate tasks,deactivate clock", log.join(","));
    Assert.isTrue(diagnostics.text.includes("It could not be turned off or on completely.") && diagnostics.text.includes("The clock would not stop."), diagnostics.text);
    Assert.areEqual(1, events.broadcasts.filter(t => t.name.text === "desktop.modulesChanged").length);
    await host.deactivateAsync();
  }

  @TestMethod
  public async settlesChangesInARowOnTheValueTheSettingEndsWithAndHearsNoneOnceDeactivated(): Promise<void> {
    await using settings = await SettingsFixture.createAsync([ModuleSwitchTests.define(true)]);
    const log: string[] = [];
    const host = ModuleSwitchTests.create(log, []);
    await host.activateAsync(settings.service, settings.processes);
    log.splice(0);

    ModuleSwitchTests.write(settings, false);
    ModuleSwitchTests.write(settings, true);
    await host.switching;
    const twice = log.splice(0).join(",");
    const settled = ModuleSwitchTests.describe(host);
    await host.deactivateAsync();
    log.splice(0);
    ModuleSwitchTests.write(settings, false);
    await host.switching;

    Assert.areEqual(String.empty, twice);
    Assert.areEqual(0, log.length);
    Assert.areEqual("clock Active clock.enabled,theme Active,tasks Active,notes Active", settled);
  }

  @TestMethod
  public async turnsAModuleOffWhoseSwitchChangesWhileTheModulesStartOnceTheyHaveStarted(): Promise<void> {
    await using settings = await SettingsFixture.createAsync([ModuleSwitchTests.define(true)]);
    const log: string[] = [];
    const host = ModuleHostFixture.create([
      ModuleSwitchTests.declare("clock", [], ModuleSwitchTests.SWITCH),
      ModuleHostFixture.declare("theme", [], "theme-runtime")
    ], new Map<string, IRuntimePart>([
      ["clock-runtime", new RuntimePartFixture("clock", log)],
      ["theme-runtime", new RuntimePartFixture("theme", log, () => ModuleSwitchTests.write(settings, false))]
    ]));

    await host.activateAsync(settings.service, settings.processes);
    await host.switching;

    Assert.areEqual("clock Off clock.enabled,theme Active", ModuleSwitchTests.describe(host));
    Assert.areEqual("activate clock,activate theme,deactivate clock", log.join(","));
    await host.deactivateAsync();
  }

  @TestMethod
  public refusesASwitchSettingThatIsNotItsOwnBooleanSharedSettingWithoutScopes(): void {
    const scoped = new SettingDefinition(QualifiedName.parse(ModuleSwitchTests.SWITCH), "Clock", "Turns the clock on.", SettingType.boolean(), true, SettingLocality.Shared,
      [QualifiedName.parse("clock.workspace")], "Clock", "Clock");
    const cases: readonly (readonly SettingDefinition[])[] = [
      [],
      [new SettingDefinition(QualifiedName.parse(ModuleSwitchTests.SWITCH), "Clock", "Turns the clock on.", SettingType.boolean(), true, SettingLocality.Device, [], "Clock", "Clock")],
      [scoped]
    ];

    for (const definitions of cases)
      Assert.areEqual("switchSetting", Assert.throws(() => new ModuleDeclaration("clock", "0.0.1", "clock", "clock", new Map(), null,
        new Map([["settings", definitions.map(t => t.name.text)]]), definitions, null, [], null, false, new Map(), ModuleSwitchTests.SWITCH), ArgumentException).parameterName);
  }

  private static create(log: string[], heard: string[], methods: MethodRegistry = new MethodRegistry(), events: EventSinkFixture = new EventSinkFixture()): ModuleHost {
    return ModuleHostFixture.create([
      ModuleSwitchTests.declare("clock", [], ModuleSwitchTests.SWITCH),
      ModuleHostFixture.declare("theme", [], "theme-runtime"),
      ModuleHostFixture.declare("tasks", ["clock"], "tasks-runtime"),
      new ModuleDeclaration("notes", "0.0.1", "notes", "notes", new Map(), "notes-runtime", new Map([["methods", ["notes.run"]]]), [], null, [], null, false,
        new Map([["clock", "0.0.1"]]))
    ], new Map<string, IRuntimePart>([
      ["clock-runtime", new RuntimePartFixture("clock", log, t => t.registerMethod("clock.run", { handleAsync: async () => null }))],
      ["theme-runtime", new RuntimePartFixture("theme", log, t => t.registerMethod("theme.run", { handleAsync: async () => null }))],
      ["tasks-runtime", new RuntimePartFixture("tasks", log, t => t.registerMethod("tasks.run", { handleAsync: async () => null }))],
      ["notes-runtime", new RuntimePartFixture("notes", log, t => {
        t.onDependencyChanged((moduleId, isActive) => heard.push(`${moduleId} ${isActive}`));
      })]
    ]), methods, new TextOutputFixture(), path.resolve("noldova-desktop-data"), new WorkTracker(() => undefined), events);
  }

  private static declare(id: string, dependencies: readonly string[], switchSetting: string): ModuleDeclaration {
    return new ModuleDeclaration(id, "0.0.1", id, id, new Map(dependencies.map(t => [t, "0.0.1"])), `${id}-runtime`,
      new Map([["methods", [`${id}.run`]], ["settings", [switchSetting]]]), [ModuleSwitchTests.define(true)], null, [], null, false, new Map(), switchSetting);
  }

  private static define(defaultValue: boolean): SettingDefinition {
    return new SettingDefinition(QualifiedName.parse(ModuleSwitchTests.SWITCH), "Clock", "Turns the clock on.", SettingType.boolean(), defaultValue, SettingLocality.Shared, [],
      "Clock", "Clock");
  }

  private static write(settings: SettingsFixture, value: boolean): void {
    settings.service.write(new SettingValue(new SettingKey(QualifiedName.parse(ModuleSwitchTests.SWITCH)), value));
  }

  private static describe(host: ModuleHost): string {
    return host.report.modules.map(t => [t.id, t.state, t.cause, t.blockedBy, t.switchSetting].filter(u => !Object.isNull(u)).join(" ")).join(",");
  }
}
