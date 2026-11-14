/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { BuildCommandLine } from "@noldova/desktop.build";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ModuleSettings } from "../../../src/services/modules/module-settings.js";
import { ModuleAppFixture } from "../../fixtures/module-app.fixture.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class ModuleSettingsTests {
  private static readonly FOLDER: string = "src/modules/notes";
  private static readonly FILE: string = "src/modules/notes/settings.json";
  private static readonly NAME: string = "notes.enabled";
  private static readonly FIRST: string = "src/modules/notes/settings.json settings[0] must have ";
  private static readonly TYPE_INVALID: string =
    "a type of kind Boolean, Choice, Number, Text, Modules or Action, with exactly that kind's fields, a choice either options or dynamic, and a text optionally checked.";
  private static readonly NUMBER_INVALID: string = "a number type whose minimum is no greater than its maximum and whose step is positive.";

  private static readonly SETTINGS: string = "node_modules/@noldova/sample/settings.json";
  private static readonly PAGE: Readonly<Record<string, string>> = { name: "sample.account", title: "Account" };
  private static readonly NO_PRODUCT: string = "The root package.json must declare desktop.product.\n";
  private static readonly SETTING: string = "node_modules/@noldova/sample/settings.json settings[0] must have ";

  @TestMethod
  public async writesEachModulesSettingsPagesToItsWindowPartSource(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    await app.writeContributionsAsync({ settingsPages: ["sample.account"] });
    await app.writeModuleJsonAsync(null, "settings.json", { settings: [], pages: [ModuleSettingsTests.PAGE] });

    await ModuleSettingsTests.runAsync(app, await app.writeNpmAsync());

    const sources = await readFile(path.join(app.path, "_build", "generated", "window-parts.ts"), "utf8");
    Assert.isTrue(sources.includes(".then(t => t.windowPart), [], [], [{\"name\":\"sample.account\",\"title\":\"Account\"}])"), sources);
  }

  @TestMethod
  public async refusesSettingsPagesWithoutASettingsFile(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeContributionsAsync({ settingsPages: ["sample.account"] });

    const output = await ModuleSettingsTests.runAsync(app);

    Assert.isTrue(output.endsWith(`node_modules/@noldova/sample/module.json declares settings or settings pages, but ${ModuleSettingsTests.SETTINGS} is missing.\n`), output);
  }

  @TestMethod
  public async refusesASettingsFileWithAFieldBesideSettingsAndPages(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeModuleJsonAsync(null, "settings.json", { settings: [], views: [] });

    const output = await ModuleSettingsTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleSettingsTests.SETTINGS} must be an object whose field "settings" lists the module's settings, `
      + "and whose only other field, \"pages\", lists its own pages.\n"), output);
  }

  @TestMethod
  public async refusesPagesThatAreNotAListOfNamesAndTitles(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeContributionsAsync({ settingsPages: ["sample.account"] });
    const outputs: string[] = [];
    for (const pages of [{}, [{ name: "sample.account", title: " " }], [{ name: 1, title: "Account" }], [{ ...ModuleSettingsTests.PAGE, glyph: "person" }]]) {
      await app.writeModuleJsonAsync(null, "settings.json", { settings: [], pages });
      outputs.push(await ModuleSettingsTests.runAsync(app));
    }

    Assert.areEqual(4, outputs.filter(t => t.endsWith(`${ModuleSettingsTests.SETTINGS} pages[0] must have exactly the fields name, title, with a title that is not blank.\n`)).length,
      outputs.join("\n"));
  }

  @TestMethod
  public async refusesPagesThatDifferFromTheDeclaredOnes(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeContributionsAsync({ settingsPages: ["sample.account"] });
    const outputs: string[] = [];
    for (const pages of [[], [ModuleSettingsTests.PAGE, ModuleSettingsTests.PAGE], [ModuleSettingsTests.PAGE, { name: "sample.team", title: "Team" }]]) {
      await app.writeModuleJsonAsync(null, "settings.json", { settings: [], pages });
      outputs.push(await ModuleSettingsTests.runAsync(app));
    }

    Assert.areEqual(3, outputs.filter(t => t.endsWith(`${ModuleSettingsTests.SETTINGS} must define each settings page that module.json declares, once, and no other.\n`)).length,
      outputs.join("\n"));
  }

  @TestMethod
  public async refusesSettingsPagesFromAModuleWithoutAWindowPart(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeTreeModuleAsync("clock", ["runtime"], { settingsPages: ["clock.alarms"] });
    await app.writeModuleJsonAsync("clock", "settings.json", { settings: [], pages: [{ name: "clock.alarms", title: "Alarms" }] });

    const output = await ModuleSettingsTests.runAsync(app);

    Assert.isTrue(output.endsWith("src/modules/clock/module.json declares settings pages without a window part, which registers them.\n"), output);
  }

  @TestMethod
  public async refusesAPageTitleThatNoldovaDesktopOrAnotherModuleAlreadyGives(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeContributionsAsync({ settingsPages: ["sample.account"] });
    await app.writeModuleJsonAsync(null, "settings.json", { settings: [], pages: [{ name: "sample.account", title: "Appearance" }] });
    await app.writeTreeModuleAsync("clock", ["runtime", "window"], { settingsPages: ["clock.alarms"] });
    await app.writeModuleJsonAsync("clock", "settings.json", { settings: [], pages: [{ name: "clock.alarms", title: "Appearance" }] });

    const output = await ModuleSettingsTests.runAsync(app);

    Assert.isTrue(output.endsWith("Settings page titles repeat in the build, and a title names one page: "
      + "Appearance for sample.account in node_modules/@noldova/sample/module.json, Appearance for clock.alarms in src/modules/clock/module.json.\n"), output);
  }

  @TestMethod
  public async refusesAPageTitleThatAnotherModulesSettingsNameAsTheirPage(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeSettingAsync({ kind: "Boolean" }, true);
    await app.writeTreeModuleAsync("clock", ["runtime", "window"], { settingsPages: ["clock.alarms"] });
    await app.writeModuleJsonAsync("clock", "settings.json", { settings: [], pages: [{ name: "clock.alarms", title: "Sample" }] });

    const output = await ModuleSettingsTests.runAsync(app);

    Assert.isTrue(output.endsWith("Settings page titles repeat in the build, and a title names one page: Sample for clock.alarms in src/modules/clock/module.json.\n"), output);
  }

  @TestMethod
  public async letsTheSettingsOfAModuleThatDependsOnAPagesModuleNameThatPage(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    await app.writeContributionsAsync({ settingsPages: ["sample.account"] });
    await app.writeModuleJsonAsync(null, "settings.json", { settings: [], pages: [ModuleSettingsTests.PAGE] });
    await app.writeTreeModuleAsync("clock", ["runtime", "window"], { settings: ["clock.zone"] }, { sample: ModuleAppFixture.MODULE_VERSION });
    await app.writeModuleJsonAsync("clock", "settings.json", { settings: [ModuleSettingsTests.setting("clock.zone", "Account")] });

    const output = await ModuleSettingsTests.runAsync(app, await app.writeNpmAsync());

    const sources = await readFile(path.join(app.path, "_build", "generated", "window-parts.ts"), "utf8");
    Assert.isFalse(output.includes("Settings page titles repeat"), output);
    Assert.isTrue(sources.includes("[{\"name\":\"sample.account\",\"title\":\"Account\"}]"), sources);
  }

  @TestMethod
  public async refusesAPageTitleThatItsOwnModulesSettingsNameAsTheirPage(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeTreeModuleAsync("clock", ["runtime", "window"], { settings: ["clock.zone"], settingsPages: ["clock.alarms"] });
    await app.writeModuleJsonAsync("clock", "settings.json", { settings: [ModuleSettingsTests.setting("clock.zone", "Alarms")], pages: [{ name: "clock.alarms", title: "Alarms" }] });

    const output = await ModuleSettingsTests.runAsync(app);

    Assert.isTrue(output.endsWith("Settings page titles repeat in the build, and a title names one page: Alarms for clock.alarms in src/modules/clock/module.json.\n"), output);
  }

  @TestMethod
  public async refusesTwoModulesPagesWithOneTitleAndNamesTheLaterOne(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeContributionsAsync({ settingsPages: ["sample.account"] });
    await app.writeModuleJsonAsync(null, "settings.json", { settings: [], pages: [{ name: "sample.account", title: "Alarms" }] });
    await app.writeTreeModuleAsync("clock", ["runtime", "window"], { settingsPages: ["clock.alarms"] });
    await app.writeModuleJsonAsync("clock", "settings.json", { settings: [], pages: [{ name: "clock.alarms", title: "Alarms" }] });

    const output = await ModuleSettingsTests.runAsync(app);

    Assert.isTrue(output.endsWith("Settings page titles repeat in the build, and a title names one page: Alarms for clock.alarms in src/modules/clock/module.json.\n"), output);
  }

  @TestMethod
  @TestData("{\"kind\":\"Choice\",\"dynamic\":true}", "\"\"")
  @TestData("{\"kind\":\"Choice\",\"dynamic\":true}", "\"example-model\"")
  @TestData("{\"kind\":\"Choice\",\"options\":[{\"value\":\"\",\"title\":\"Provider default\"},{\"value\":\"high\",\"title\":\"High\"}]}", "\"\"")
  public acceptsADynamicChoiceAndAnEmptyOptionValue(type: string, defaultValue: string): Promise<void> {
    return ModuleSettingsTests.assertOutputAsync(type, defaultValue, ModuleSettingsTests.NO_PRODUCT);
  }

  @TestMethod
  @TestData("{\"kind\":\"Choice\",\"dynamic\":true,\"options\":[{\"value\":\"high\",\"title\":\"High\"}]}", "\"high\"",
    "a type of kind Boolean, Choice, Number, Text, Modules or Action, with exactly that kind's fields, a choice either options or dynamic, and a text optionally checked.")
  @TestData("{\"kind\":\"Choice\"}", "\"high\"",
    "a type of kind Boolean, Choice, Number, Text, Modules or Action, with exactly that kind's fields, a choice either options or dynamic, and a text optionally checked.")
  @TestData("{\"kind\":\"Choice\",\"dynamic\":false}", "\"high\"", "a dynamic choice type whose dynamic is true.")
  @TestData("{\"kind\":\"Choice\",\"dynamic\":true}", "1", "a default its type accepts.")
  @TestData("{\"kind\":\"Choice\",\"options\":[{\"value\":\" \",\"title\":\"Blank\"}]}", "\" \"",
    "a choice type with options, each with a distinct value, empty or not blank, and a title that is not blank.")
  public refusesAChoiceThatIsNeitherFixedNorDynamic(type: string, defaultValue: string, problem: string): Promise<void> {
    return ModuleSettingsTests.assertOutputAsync(type, defaultValue, `${ModuleSettingsTests.SETTING}${problem}\n`);
  }

  @TestMethod
  public acceptsACheckedText(): Promise<void> {
    return ModuleSettingsTests.assertOutputAsync("{\"kind\":\"Text\",\"maxLength\":200,\"checked\":true}", "\"github.com\"", ModuleSettingsTests.NO_PRODUCT);
  }

  @TestMethod
  @TestData("{\"kind\":\"Text\",\"maxLength\":200,\"checked\":false}", "\"\"", "a checked text type whose checked is true.")
  @TestData("{\"kind\":\"Text\",\"maxLength\":200,\"checked\":\"true\"}", "\"\"", "a checked text type whose checked is true.")
  @TestData("{\"kind\":\"Boolean\",\"checked\":true}", "false",
    "a type of kind Boolean, Choice, Number, Text, Modules or Action, with exactly that kind's fields, a choice either options or dynamic, and a text optionally checked.")
  public refusesACheckedFieldThatIsntATextsTrue(type: string, defaultValue: string, problem: string): Promise<void> {
    return ModuleSettingsTests.assertOutputAsync(type, defaultValue, `${ModuleSettingsTests.SETTING}${problem}\n`);
  }

  @TestMethod
  public async readsSettingsOfEveryKindItsModuleDeclares(): Promise<void> {
    const settings = [
      ModuleSettingsTests.define({}),
      ModuleSettingsTests.define({ name: "notes.size", type: { kind: "Number", minimum: 8, maximum: 32, step: 0.5 }, default: 12.5, locality: "Device" }),
      ModuleSettingsTests.define({ name: "notes.font", type: { kind: "Text", maxLength: 20 }, default: "Serif" }),
      ModuleSettingsTests.define({ name: "notes.shown", type: { kind: "Modules" }, default: ["notes", "tasks"] }),
      ModuleSettingsTests.define({ name: "notes.reset", type: { kind: "Action", command: "notes.clear", label: "Clear" }, default: null }),
      ModuleSettingsTests.define({
        name: "notes.sort", type: { kind: "Choice", options: [{ value: "date", title: "Date" }, { value: "title", title: "Title" }] }, default: "date", scopes: ["notes.folder", "tasks.list"]
      })
    ];
    await using tree = await SourceTreeFixture.createAsync({ [ModuleSettingsTests.FILE]: JSON.stringify({ settings }) });

    const file = await ModuleSettings.readAsync(tree.path, ModuleSettingsTests.FOLDER, ["tasks"], ModuleSettingsTests.contribute(settings.map(t => String(t["name"]))));

    Assert.areEqual(JSON.stringify(settings), JSON.stringify(file.settings));
    Assert.areEqual(0, file.pages.length);
  }

  @TestMethod
  public async refusesASettingsFileThatIsNotJson(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ [ModuleSettingsTests.FILE]: "{\"settings\":[" });

    const error = await Assert.throwsAsync(() => ModuleSettings.readAsync(tree.path, ModuleSettingsTests.FOLDER, [], ModuleSettingsTests.contribute([])), BuildException);

    Assert.areEqual(`${ModuleSettingsTests.FILE} could not be read as JSON.`, error.message);
  }

  @TestMethod
  @TestData(0, 1)
  @TestData(2, 1)
  @TestData(1, 0)
  public async refusesSettingsThatDifferFromTheDeclaredOnes(defined: number, declared: number): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ [ModuleSettingsTests.FILE]: JSON.stringify({ settings: ModuleSettingsTests.repeat(defined, ModuleSettingsTests.define({})) }) });

    const error = await Assert.throwsAsync(
      () => ModuleSettings.readAsync(tree.path, ModuleSettingsTests.FOLDER, [], ModuleSettingsTests.contribute(ModuleSettingsTests.repeat(declared, ModuleSettingsTests.NAME))), BuildException);

    Assert.areEqual(`${ModuleSettingsTests.FILE} must define each setting that module.json declares, once, and no other.`, error.message);
  }

  @TestMethod
  public async refusesASettingWithoutExactlyTheSettingFields(): Promise<void> {
    const withoutGroup = Object.fromEntries(Object.entries(ModuleSettingsTests.define({})).filter(([name]) => name !== "group"));
    const messages = await ModuleSettingsTests.failEachAsync([1, "notes.enabled", null, withoutGroup, ModuleSettingsTests.define({ hint: "On" })]);

    Assert.areEqual(
      ModuleSettingsTests.repeat(5, `${ModuleSettingsTests.FIRST}exactly the fields name, title, description, type, default, locality, scopes, page, group.`).join("\n"), messages.join("\n"));
  }

  @TestMethod
  public async refusesASettingWhoseTextsAreBlank(): Promise<void> {
    const messages = await ModuleSettingsTests.failEachAsync([
      ModuleSettingsTests.define({ title: " " }), ModuleSettingsTests.define({ description: 1 }), ModuleSettingsTests.define({ page: String.empty }), ModuleSettingsTests.define({ group: null })
    ]);

    Assert.areEqual(ModuleSettingsTests.repeat(4, `${ModuleSettingsTests.FIRST}a title, description, page and group that are not blank.`).join("\n"), messages.join("\n"));
  }

  @TestMethod
  public async refusesALocalityOtherThanDeviceOrShared(): Promise<void> {
    const messages = await ModuleSettingsTests.failEachAsync([ModuleSettingsTests.define({ locality: "Global" }), ModuleSettingsTests.define({ locality: 1 })]);

    Assert.areEqual(ModuleSettingsTests.repeat(2, `${ModuleSettingsTests.FIRST}the locality Device or Shared.`).join("\n"), messages.join("\n"));
  }

  @TestMethod
  public async refusesScopesThatAreNotDistinctDeclaredOnesOrAnyForADeviceSetting(): Promise<void> {
    const messages = await ModuleSettingsTests.failEachAsync([
      ModuleSettingsTests.define({ scopes: "notes.folder" }),
      ModuleSettingsTests.define({ scopes: ["other.folder"] }),
      ModuleSettingsTests.define({ scopes: ["tasksx.list"] }),
      ModuleSettingsTests.define({ scopes: [1] }),
      ModuleSettingsTests.define({ scopes: ["notes.folder", "notes.folder"] }),
      ModuleSettingsTests.define({ scopes: ["notes.folder"], locality: "Device" })
    ]);

    Assert.areEqual(
      ModuleSettingsTests.repeat(6, `src/modules/notes/settings.json settings[0] must list distinct scopes, each one its module declares among its settingScopes or a dependency's, and none for a device setting.`).join("\n"),
      messages.join("\n"));
  }

  @TestMethod
  public async refusesATypeThatIsNotOneKindWithExactlyItsFields(): Promise<void> {
    const messages = await ModuleSettingsTests.failEachAsync([
      ModuleSettingsTests.define({ type: "Boolean" }),
      ModuleSettingsTests.define({ type: { kind: 1 } }),
      ModuleSettingsTests.define({ type: { kind: "Color" } }),
      ModuleSettingsTests.define({ type: { kind: "Number", minimum: 0 } }),
      ModuleSettingsTests.define({ type: { kind: "Boolean", maxLength: 2 } })
    ]);

    Assert.areEqual(ModuleSettingsTests.repeat(5, `${ModuleSettingsTests.FIRST}${ModuleSettingsTests.TYPE_INVALID}`).join("\n"), messages.join("\n"));
  }

  @TestMethod
  public async refusesATextWhoseMaxLengthIsNotAPositiveInteger(): Promise<void> {
    const messages = await ModuleSettingsTests.failEachAsync([0, -3, 1.5, "20"].map(t => ModuleSettingsTests.define({ type: { kind: "Text", maxLength: t }, default: String.empty })));

    Assert.areEqual(ModuleSettingsTests.repeat(4, `${ModuleSettingsTests.FIRST}a text type whose maxLength is a positive integer.`).join("\n"), messages.join("\n"));
  }

  @TestMethod
  public async refusesAnActionWhoseCommandIsNotDeclaredOrWhoseLabelIsBlank(): Promise<void> {
    const messages = await ModuleSettingsTests.failEachAsync([
      ModuleSettingsTests.define({ type: { kind: "Action", command: "notes.other", label: "Clear" }, default: null }),
      ModuleSettingsTests.define({ type: { kind: "Action", command: "notes.clear", label: " " }, default: null }),
      ModuleSettingsTests.define({ type: { kind: "Action", command: "notes.clear", label: 1 }, default: null })
    ]);

    Assert.areEqual(
      ModuleSettingsTests.repeat(3, `${ModuleSettingsTests.FIRST}an action type whose command is one its module declares and whose label is not blank.`).join("\n"), messages.join("\n"));
  }

  @TestMethod
  public async refusesAChoiceWithoutOptionsOfDistinctValuesAndTitles(): Promise<void> {
    const messages = await ModuleSettingsTests.failEachAsync([
      "date",
      [],
      [1],
      [{ value: "date", title: "Date", icon: "calendar" }],
      [{ value: "date", title: " " }],
      [{ value: 1, title: "One" }],
      [{ value: "date", title: "Date" }, { value: "date", title: "Day" }]
    ].map(t => ModuleSettingsTests.define({ type: { kind: "Choice", options: t }, default: "date" })));

    Assert.areEqual(
      ModuleSettingsTests.repeat(7, `${ModuleSettingsTests.FIRST}a choice type with options, each with a distinct value, empty or not blank, and a title that is not blank.`).join("\n"),
      messages.join("\n"));
  }

  @TestMethod
  public async refusesANumberWhoseRangeOrStepIsInvalid(): Promise<void> {
    const messages = await ModuleSettingsTests.failEachAsync([
      { minimum: "0", maximum: 10, step: 1 },
      { minimum: 0, maximum: null, step: 1 },
      { minimum: 10, maximum: 0, step: 1 },
      { minimum: 0, maximum: 10, step: 0 },
      { minimum: 0, maximum: 10, step: -1 }
    ].map(t => ModuleSettingsTests.define({ type: { kind: "Number", ...t }, default: 0 })));

    Assert.areEqual(ModuleSettingsTests.repeat(5, `${ModuleSettingsTests.FIRST}${ModuleSettingsTests.NUMBER_INVALID}`).join("\n"), messages.join("\n"));
  }

  @TestMethod
  public async acceptsANumberOnAStepAndAtEitherEndOfItsRange(): Promise<void> {
    const values = [8, 8.5, 31.5, 32];
    const settings = values.map((t, index) => ModuleSettingsTests.define({ name: `notes.size${index}`, type: { kind: "Number", minimum: 8, maximum: 32, step: 0.5 }, default: t }));
    await using tree = await SourceTreeFixture.createAsync({ [ModuleSettingsTests.FILE]: JSON.stringify({ settings }) });

    const file = await ModuleSettings.readAsync(tree.path, ModuleSettingsTests.FOLDER, [], ModuleSettingsTests.contribute(settings.map(t => String(t["name"]))));

    Assert.areEqual(values.join(), file.settings.map(t => String(t["default"])).join());
  }

  @TestMethod
  public async refusesADefaultItsTypeDoesNotAccept(): Promise<void> {
    const number = { kind: "Number", minimum: 8, maximum: 32, step: 0.5 };
    const messages = await ModuleSettingsTests.failEachAsync([
      ModuleSettingsTests.define({ default: "true" }),
      ModuleSettingsTests.define({ type: number, default: 12.3 }),
      ModuleSettingsTests.define({ type: number, default: 7.5 }),
      ModuleSettingsTests.define({ type: number, default: 32.5 }),
      ModuleSettingsTests.define({ type: number, default: "12" }),
      ModuleSettingsTests.define({ type: { kind: "Text", maxLength: 3 }, default: "Serif" }),
      ModuleSettingsTests.define({ type: { kind: "Text", maxLength: 3 }, default: 1 }),
      ModuleSettingsTests.define({ type: { kind: "Modules" }, default: "notes" }),
      ModuleSettingsTests.define({ type: { kind: "Modules" }, default: ["notes", "notes"] }),
      ModuleSettingsTests.define({ type: { kind: "Modules" }, default: [" "] }),
      ModuleSettingsTests.define({ type: { kind: "Action", command: "notes.clear", label: "Clear" }, default: false }),
      ModuleSettingsTests.define({ type: { kind: "Choice", options: [{ value: "date", title: "Date" }] }, default: "title" })
    ]);

    Assert.areEqual(ModuleSettingsTests.repeat(12, `${ModuleSettingsTests.FIRST}a default its type accepts.`).join("\n"), messages.join("\n"));
  }

  private static define(fields: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
    return {
      name: ModuleSettingsTests.NAME,
      title: "Enabled",
      description: "Whether the notes are on.",
      type: { kind: "Boolean" },
      default: true,
      locality: "Shared",
      scopes: [],
      page: "Notes",
      group: "General",
      ...fields
    };
  }

  private static repeat<T>(count: number, value: T): readonly T[] {
    return Array.from({ length: count }, () => value);
  }

  private static contribute(settings: readonly string[]): ReadonlyMap<string, readonly string[]> {
    return new Map([["settings", settings], ["settingScopes", ["notes.folder"]], ["commands", ["notes.clear"]]]);
  }

  private static async failEachAsync(definitions: readonly unknown[]): Promise<readonly string[]> {
    const messages: string[] = [];
    for (const definition of definitions) {
      await using tree = await SourceTreeFixture.createAsync({ [ModuleSettingsTests.FILE]: JSON.stringify({ settings: [definition] }) });
      const error = await Assert.throwsAsync(
        () => ModuleSettings.readAsync(tree.path, ModuleSettingsTests.FOLDER, ["tasks"], ModuleSettingsTests.contribute([ModuleSettingsTests.NAME])), BuildException);
      messages.push(error.message);
    }
    return messages;
  }

  private static setting(name: string, page: string): Readonly<Record<string, unknown>> {
    return { name, title: "Time zone", description: "The zone the clock shows.", type: { kind: "Boolean" }, default: true, locality: "Device", scopes: [], page, group: "Clock" };
  }

  private static async runAsync(app: ModuleAppFixture, environment: NodeJS.ProcessEnv = {}): Promise<string> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    await new BuildCommandLine(app.path, environment, process.platform, process.arch, output, new PassThrough()).runAsync(["build"]);
    return chunks.join(String.empty);
  }

  private static async assertOutputAsync(type: string, defaultValue: string, ending: string): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeSettingAsync(JSON.parse(type), JSON.parse(defaultValue));

    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    await new BuildCommandLine(app.path, {}, process.platform, process.arch, output, new PassThrough()).runAsync(["build"]);
    const text = chunks.join(String.empty);

    Assert.isTrue(text.endsWith(ending), text);
  }
}
