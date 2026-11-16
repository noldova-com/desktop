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
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { BuildCommandLine } from "@noldova/desktop.build";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ModuleDeclaration } from "../../../src/models/modules/module-declaration.js";
import { Resources } from "../../../src/resources.js";
import { ModuleAppFixture } from "../../fixtures/module-app.fixture.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class ModuleDeclarationTests {
  private static readonly NO_PRODUCT: string = "The root package.json must declare desktop.product.\n";
  private static readonly DECLARATION: string = "node_modules/@noldova/sample/module.json ";
  private static readonly BOOLEAN: Readonly<Record<string, unknown>> = { kind: "Boolean" };
  private static readonly FOLDER: string = "src/modules/notes";
  private static readonly FILE: string = "src/modules/notes/module.json";
  private static readonly PACKAGE: string = "@sample/notes";
  private static readonly PACKAGE_FOLDER: string = "node_modules/@sample/notes";
  private static readonly PACKAGE_FILE: string = "node_modules/@sample/notes/module.json";
  private static readonly PACKAGE_MANIFEST: string = "node_modules/@sample/notes/package.json";
  private static readonly BASE: Readonly<Record<string, unknown>> = {
    id: "notes",
    version: "0.0.1",
    displayName: "Notes",
    description: "Takes notes.",
    parts: [],
    dependencies: {},
    contributes: {}
  };

  @TestMethod
  public async acceptsOnePlaceholderInTheBuild(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeContributionsAsync({ placeholders: ["sample.start"] });
    await app.writeTreeModuleAsync("clock", ["runtime", "window"], { views: ["clock.face"] });

    const output = await ModuleDeclarationTests.runAsync(app);

    Assert.isTrue(output.endsWith(ModuleDeclarationTests.NO_PRODUCT), output);
  }

  @TestMethod
  public async refusesAModuleThatDeclaresTwoPlaceholders(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeContributionsAsync({ placeholders: ["sample.start", "sample.welcome"] });

    const output = await ModuleDeclarationTests.runAsync(app);

    Assert.isTrue(output.endsWith("node_modules/@noldova/sample/module.json declares more than one placeholder, and a window shows one.\n"), output);
  }

  @TestMethod
  public async refusesAPlaceholderFromAModuleWithoutAWindowPart(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeTreeModuleAsync("clock", ["runtime"], { placeholders: ["clock.start"] });

    const output = await ModuleDeclarationTests.runAsync(app);

    Assert.isTrue(output.endsWith("src/modules/clock/module.json declares a placeholder without a window part, which registers it.\n"), output);
  }

  @TestMethod
  public async refusesPlaceholdersFromTwoModulesOfTheBuild(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeContributionsAsync({ placeholders: ["sample.start"] });
    await app.writeTreeModuleAsync("clock", ["runtime", "window"], { placeholders: ["clock.start"] });

    const output = await ModuleDeclarationTests.runAsync(app);

    Assert.isTrue(output.endsWith("Placeholders repeat in the build, which shows one: "
      + "sample.start in node_modules/@noldova/sample/module.json, clock.start in src/modules/clock/module.json.\n"), output);
  }

  @TestMethod
  public async writesThePlatformsToTheDeclarationsOnlyForAModuleThatNamesThem(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    await app.writeDeclarationAsync({ platforms: ["windows", "macos"] }, ["runtime", "window"]);
    await app.writeTreeModuleAsync("clock", ["runtime"], {});

    await ModuleDeclarationTests.runAsync(app, await app.writeNpmAsync());

    const modules = JsonReader.parse(await readFile(path.join(app.path, "_build", "modules", "declarations.json"), "utf8")).readObjectArray("modules");
    Assert.areEqual(
      "clock|false|,sample|true|windows macos",
      modules.map(t => `${t.readString("id")}|${String(t.hasField("platforms"))}|${t.hasField("platforms") ? t.readStringArray("platforms").join(" ") : String.empty}`).sort().join(","));
  }

  @TestMethod
  @TestData("[\"freebsd\"]")
  @TestData("[\"linux\", \"linux\"]")
  @TestData("[\"Windows\"]")
  @TestData("[1]")
  @TestData("\"windows\"")
  @TestData("null")
  public async refusesPlatformsThatAreNotEachOfWindowsMacosAndLinuxOnce(value: string): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeDeclarationAsync({ platforms: JSON.parse(value) }, ["runtime", "window"]);

    const output = await ModuleDeclarationTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleDeclarationTests.DECLARATION}must list its platforms once each as windows, macos or linux.\n`), output);
  }

  @TestMethod
  public async refusesAnEmptyListOfPlatforms(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeDeclarationAsync({ platforms: [] }, ["runtime", "window"]);

    const output = await ModuleDeclarationTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleDeclarationTests.DECLARATION}must name at least one platform as its platforms, or leave the field out to run on every platform.\n`), output);
  }

  @TestMethod
  @TestData(true)
  @TestData(false)
  public acceptsPseudoTerminalsDeclaredTrueOrFalse(value: boolean): Promise<void> {
    return ModuleDeclarationTests.assertOutputAsync({ pseudoTerminals: value }, ["runtime", "window"], ModuleDeclarationTests.NO_PRODUCT);
  }

  @TestMethod
  @TestData("\"yes\"")
  @TestData("1")
  @TestData("null")
  public refusesPseudoTerminalsThatAreNotTrueOrFalse(value: string): Promise<void> {
    return ModuleDeclarationTests.assertOutputAsync({ pseudoTerminals: JSON.parse(value) }, ["runtime", "window"],
      `${ModuleDeclarationTests.DECLARATION}must declare pseudoTerminals as true or false.\n`);
  }

  @TestMethod
  public refusesPseudoTerminalsFromAModuleWithoutARuntimePart(): Promise<void> {
    return ModuleDeclarationTests.assertOutputAsync({ pseudoTerminals: true }, ["window"],
      `${ModuleDeclarationTests.DECLARATION}declares pseudo-terminals without a runtime part, which starts them.\n`);
  }

  @TestMethod
  public async acceptsOneOfItsOwnBooleanSharedSettingsWithoutScopes(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeSettingAsync(ModuleDeclarationTests.BOOLEAN, true, "Shared");
    await app.writeDeclarationAsync({ switchSetting: ModuleAppFixture.SETTING }, ["runtime", "window"]);

    const output = await ModuleDeclarationTests.runAsync(app);

    Assert.isTrue(output.endsWith(ModuleDeclarationTests.NO_PRODUCT), output);
  }

  @TestMethod
  public async writesTheSwitchSettingToTheDeclarationsOnlyForAModuleThatHasOne(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    await app.writeSettingAsync(ModuleDeclarationTests.BOOLEAN, false, "Shared");
    await app.writeDeclarationAsync({ switchSetting: ModuleAppFixture.SETTING }, ["runtime", "window"]);
    await app.writeTreeModuleAsync("clock", ["runtime"], {});

    await ModuleDeclarationTests.runAsync(app, await app.writeNpmAsync());

    const modules = JsonReader.parse(await readFile(path.join(app.path, "_build", "modules", "declarations.json"), "utf8")).readObjectArray("modules");
    Assert.areEqual(
      `clock|false|,sample|true|${ModuleAppFixture.SETTING}`,
      modules.map(t => `${t.readString("id")}|${String(t.hasField("switchSetting"))}|${t.readOptionalString("switchSetting") ?? String.empty}`).sort().join(","));
  }

  @TestMethod
  @TestData("\"sample.other\"")
  @TestData("true")
  @TestData("null")
  public async refusesASwitchSettingThatIsNotOneOfItsOwnSettings(value: string): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeSettingAsync(ModuleDeclarationTests.BOOLEAN, true, "Shared");
    await app.writeDeclarationAsync({ switchSetting: JSON.parse(value) }, ["runtime", "window"]);

    const output = await ModuleDeclarationTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleDeclarationTests.DECLARATION}must name one of its own settings, which settings.json defines, as its switchSetting.\n`), output);
  }

  @TestMethod
  public async refusesASwitchSettingThatIsNotBoolean(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeSettingAsync({ kind: "Text", maxLength: 20 }, "on", "Shared");
    await app.writeDeclarationAsync({ switchSetting: ModuleAppFixture.SETTING }, ["runtime", "window"]);

    const output = await ModuleDeclarationTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleDeclarationTests.DECLARATION}has the switchSetting ${ModuleAppFixture.SETTING}, which must be a Boolean setting.\n`), output);
  }

  @TestMethod
  @TestData("Device", String.empty)
  @TestData("Shared", "sample.workspace")
  public async refusesASwitchSettingThatIsNotSharedOrHasScopes(locality: string, scope: string): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeSettingAsync(ModuleDeclarationTests.BOOLEAN, true, locality, scope === String.empty ? [] : [scope]);
    await app.writeDeclarationAsync({ switchSetting: ModuleAppFixture.SETTING }, ["runtime", "window"]);

    const output = await ModuleDeclarationTests.runAsync(app);

    Assert.isTrue(output.endsWith(
      `${ModuleDeclarationTests.DECLARATION}has the switchSetting ${ModuleAppFixture.SETTING}, which must have the locality Shared and no scopes, so one value holds for the whole app.\n`), output);
  }

  @TestMethod
  public async refusesADeclarationWithAnUnknownField(): Promise<void> {
    const message = await ModuleDeclarationTests.readFailureAsync({ ...ModuleDeclarationTests.BASE, icon: "notes.svg", color: "blue" });

    Assert.areEqual(`${ModuleDeclarationTests.FILE} has unknown fields: icon, color.`, message);
  }

  @TestMethod
  @TestData("notes", "\"tasks\"")
  @TestData("notes", "1")
  @TestData("notes", "null")
  @TestData("Notes", "\"Notes\"")
  @TestData("help", "\"help\"")
  @TestData("desktop", "\"desktop\"")
  public async refusesAnIdOtherThanItsFoldersOrAReservedOne(listedId: string, id: string): Promise<void> {
    const message = await ModuleDeclarationTests.readFailureAsync({ ...ModuleDeclarationTests.BASE, id: JSON.parse(id) }, listedId);

    Assert.areEqual(Resources.formatModuleFileProblem(ModuleDeclarationTests.FILE, Resources.formatModuleIdInvalid(listedId, false)), message);
    Assert.isTrue(message.includes("its folder's name"), message);
  }

  @TestMethod
  public async namesTheListedIdForAPackagedModuleWhoseIdDiffers(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      [ModuleDeclarationTests.PACKAGE_FILE]: JSON.stringify({ ...ModuleDeclarationTests.BASE, id: "tasks" })
    });

    const error = await Assert.throwsAsync(
      () => ModuleDeclaration.readAsync(tree.path, ModuleDeclarationTests.PACKAGE_FOLDER, false, ModuleDeclarationTests.PACKAGE, "notes"), BuildException);

    Assert.areEqual(Resources.formatModuleFileProblem(ModuleDeclarationTests.PACKAGE_FILE, Resources.formatModuleIdInvalid("notes", true)), error.message);
    Assert.isTrue(error.message.includes("as desktop.modules lists it"), error.message);
  }

  @TestMethod
  @TestData("com1")
  @TestData("nul")
  @TestData("lpt9")
  public async refusesAnIdThatNamesADeviceOnWindows(id: string): Promise<void> {
    const message = await ModuleDeclarationTests.readFailureAsync({ ...ModuleDeclarationTests.BASE, id }, id);

    Assert.areEqual(`${ModuleDeclarationTests.FILE} ${Resources.formatModuleIdWindowsDevice(id)}.`, message);
  }

  @TestMethod
  @TestData("null")
  @TestData("1")
  @TestData("\"1.0\"")
  @TestData("\"01.0.0\"")
  public async refusesAVersionThatIsNotThreeWholeNumbers(version: string): Promise<void> {
    const message = await ModuleDeclarationTests.readFailureAsync({ ...ModuleDeclarationTests.BASE, version: JSON.parse(version) });

    Assert.areEqual(Resources.formatModuleFileProblem(ModuleDeclarationTests.FILE, Resources.moduleVersionInvalid), message);
  }

  @TestMethod
  @TestData("displayName", "null", "must have a display name")
  @TestData("displayName", "\" \"", "must have a display name")
  @TestData("displayName", "1", "must have a display name")
  @TestData("description", "null", "must have a description")
  @TestData("description", "\"\"", "must have a description")
  @TestData("description", "[]", "must have a description")
  public async refusesADisplayNameOrDescriptionThatIsBlank(field: string, value: string, problem: string): Promise<void> {
    const message = await ModuleDeclarationTests.readFailureAsync({ ...ModuleDeclarationTests.BASE, [field]: JSON.parse(value) });

    Assert.areEqual(`${ModuleDeclarationTests.FILE} ${problem}.`, message);
  }

  @TestMethod
  public async refusesPartsWithoutAFolderInTheModulesTree(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      [ModuleDeclarationTests.FILE]: JSON.stringify({ ...ModuleDeclarationTests.BASE, parts: ["runtime", "window", "cli"] }),
      [`${ModuleDeclarationTests.FOLDER}/runtime/runtime-part.ts`]: String.empty
    });

    const error = await Assert.throwsAsync(() => ModuleDeclaration.readAsync(tree.path, ModuleDeclarationTests.FOLDER, false), BuildException);

    Assert.areEqual(`${ModuleDeclarationTests.FILE} declares parts without a folder: window, cli.`, error.message);
  }

  @TestMethod
  @TestData("null")
  @TestData("[]")
  @TestData("\"commands\"")
  public async refusesContributionsThatAreNotAnObject(contributes: string): Promise<void> {
    const message = await ModuleDeclarationTests.readFailureAsync({ ...ModuleDeclarationTests.BASE, contributes: JSON.parse(contributes) });

    Assert.areEqual(`${ModuleDeclarationTests.FILE} must list its contributions as an object.`, message);
  }

  @TestMethod
  public async refusesAContributionOfAnUnknownKind(): Promise<void> {
    const message = await ModuleDeclarationTests.readFailureAsync({ ...ModuleDeclarationTests.BASE, contributes: { commands: ["notes.open"], widgets: ["notes.clock"] } });

    Assert.areEqual(`${ModuleDeclarationTests.FILE} contributes an unknown kind: widgets.`, message);
  }

  @TestMethod
  @TestData("[\"tasks.open\"]")
  @TestData("[\"notes.Open\"]")
  @TestData("[\"notes.\"]")
  @TestData("[\"notesopen\"]")
  @TestData("[1]")
  @TestData("\"notes.open\"")
  public async refusesNamesThatAreNotItsOwnCamelCaseOnes(names: string): Promise<void> {
    const message = await ModuleDeclarationTests.readFailureAsync({ ...ModuleDeclarationTests.BASE, contributes: { commands: JSON.parse(names) } });

    Assert.areEqual(`${ModuleDeclarationTests.FILE} must list its commands as "notes.<name>", with a camelCase name.`, message);
  }

  @TestMethod
  public async acceptsToolNamesStartingWithItsIdOrItsIdsFirstWord(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      "src/modules/note-pad/module.json": JSON.stringify({ ...ModuleDeclarationTests.BASE, id: "note-pad", contributes: { tools: ["note_pad_search", "note_list"] } })
    });

    const declaration = await ModuleDeclaration.readAsync(tree.path, "src/modules/note-pad", false);

    Assert.areEqual("note_pad_search,note_list", (declaration.contributions.get("tools") ?? []).join());
  }

  @TestMethod
  @TestData("[\"notes\"]")
  @TestData("[\"notes_\"]")
  @TestData("[\"tasks_search\"]")
  @TestData("[\"notes_Search\"]")
  @TestData("[\"notes_search\",\"notes_search\"]")
  @TestData("[1]")
  @TestData("\"notes_search\"")
  public async refusesToolNamesThatAreNotItsOwnSnakeCaseOnesOnce(names: string): Promise<void> {
    const message = await ModuleDeclarationTests.readFailureAsync({ ...ModuleDeclarationTests.BASE, contributes: { tools: JSON.parse(names) } });

    Assert.areEqual(`${ModuleDeclarationTests.FILE} must list its tools once each as snake_case names of at most 64 characters starting with notes_.`, message);
  }

  @TestMethod
  public async refusesCommandLineCommandsFromAModuleWithoutACliPart(): Promise<void> {
    const message = await ModuleDeclarationTests.readFailureAsync({ ...ModuleDeclarationTests.BASE, contributes: { cliCommands: ["notes.list"] } });

    Assert.areEqual(`${ModuleDeclarationTests.FILE} declares command-line commands without a cli part.`, message);
  }

  @TestMethod
  public async refusesWebViewsFromAModuleWithoutAWindowPart(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      [ModuleDeclarationTests.FILE]: JSON.stringify({ ...ModuleDeclarationTests.BASE, parts: ["runtime"] }),
      [`${ModuleDeclarationTests.FOLDER}/runtime/runtime-part.ts`]: String.empty,
      [`${ModuleDeclarationTests.FOLDER}/webViews.json`]: "{}"
    });

    const error = await Assert.throwsAsync(() => ModuleDeclaration.readAsync(tree.path, ModuleDeclarationTests.FOLDER, false), BuildException);

    Assert.areEqual(`${ModuleDeclarationTests.FILE} declares web views in webViews.json without a window part, which opens them.`, error.message);
  }

  @TestMethod
  public async readsAPackagedModuleWhosePackageExportsEachOfItsParts(): Promise<void> {
    await using tree = await ModuleDeclarationTests.createPackageAsync(["runtime", "window"], { "./runtime": "./runtime.js", "./window": "./window.js" });

    const declaration = await ModuleDeclaration.readAsync(tree.path, ModuleDeclarationTests.PACKAGE_FOLDER, false, ModuleDeclarationTests.PACKAGE);

    Assert.areEqual("@sample/notes/runtime", declaration.runtimePackage);
    Assert.areEqual("@sample/notes/window", declaration.windowEntry);
    Assert.isNull(declaration.cliPackage);
  }

  @TestMethod
  public async refusesAPackagedModuleWhosePackageManifestCannotBeRead(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ [ModuleDeclarationTests.PACKAGE_FILE]: JSON.stringify(ModuleDeclarationTests.BASE) });

    const error = await Assert.throwsAsync(
      () => ModuleDeclaration.readAsync(tree.path, ModuleDeclarationTests.PACKAGE_FOLDER, false, ModuleDeclarationTests.PACKAGE), BuildException);

    Assert.areEqual(`${ModuleDeclarationTests.PACKAGE_MANIFEST} could not be read as JSON.`, error.message);
  }

  @TestMethod
  public async refusesAPackagedModuleWhosePackageHasAnotherName(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      [ModuleDeclarationTests.PACKAGE_FILE]: JSON.stringify(ModuleDeclarationTests.BASE),
      [ModuleDeclarationTests.PACKAGE_MANIFEST]: JSON.stringify({ name: "@sample/other", version: "0.0.1" })
    });

    const error = await Assert.throwsAsync(
      () => ModuleDeclaration.readAsync(tree.path, ModuleDeclarationTests.PACKAGE_FOLDER, false, ModuleDeclarationTests.PACKAGE), BuildException);

    Assert.areEqual(`${ModuleDeclarationTests.PACKAGE_MANIFEST} must have the name @sample/notes, as desktop.modules lists it, not @sample/other.`, error.message);
  }

  @TestMethod
  public async refusesAPackagedModuleWhoseVersionDiffersFromItsPackages(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      [ModuleDeclarationTests.PACKAGE_FILE]: JSON.stringify(ModuleDeclarationTests.BASE),
      [ModuleDeclarationTests.PACKAGE_MANIFEST]: JSON.stringify({ name: ModuleDeclarationTests.PACKAGE, version: "0.0.2" })
    });

    const error = await Assert.throwsAsync(
      () => ModuleDeclaration.readAsync(tree.path, ModuleDeclarationTests.PACKAGE_FOLDER, false, ModuleDeclarationTests.PACKAGE), BuildException);

    Assert.areEqual(`${ModuleDeclarationTests.PACKAGE_FILE} must have the version of its package @sample/notes, 0.0.2.`, error.message);
  }

  @TestMethod
  @TestData("\"./runtime.js\"")
  @TestData("{\"./window\":\"./window.js\"}")
  public async refusesAPackagedModuleWhosePackageDoesNotExportAPart(exports: string): Promise<void> {
    await using tree = await ModuleDeclarationTests.createPackageAsync(["runtime"], JSON.parse(exports));

    const error = await Assert.throwsAsync(
      () => ModuleDeclaration.readAsync(tree.path, ModuleDeclarationTests.PACKAGE_FOLDER, false, ModuleDeclarationTests.PACKAGE), BuildException);

    Assert.areEqual(`${ModuleDeclarationTests.PACKAGE_FILE} declares parts its package does not export at @sample/notes/<part>: runtime.`, error.message);
  }

  @TestMethod
  public async refusesAPackagedModuleWhosePackageExportsAPartItDoesNotDeclare(): Promise<void> {
    await using tree = await ModuleDeclarationTests.createPackageAsync(["runtime"], { "./runtime": "./runtime.js", "./cli": "./cli.js", "./styles": "./styles.css" });

    const error = await Assert.throwsAsync(
      () => ModuleDeclaration.readAsync(tree.path, ModuleDeclarationTests.PACKAGE_FOLDER, false, ModuleDeclarationTests.PACKAGE), BuildException);

    Assert.areEqual(`${ModuleDeclarationTests.PACKAGE_FILE} does not declare parts its package exports: cli.`, error.message);
  }

  private static async readFailureAsync(declaration: Readonly<Record<string, unknown>>, listedId: string = "notes"): Promise<string> {
    await using tree = await SourceTreeFixture.createAsync({ [ModuleDeclarationTests.FILE]: JSON.stringify(declaration) });
    const error = await Assert.throwsAsync(() => ModuleDeclaration.readAsync(tree.path, ModuleDeclarationTests.FOLDER, false, null, listedId), BuildException);
    return error.message;
  }

  private static createPackageAsync(parts: readonly string[], exports: unknown): Promise<SourceTreeFixture> {
    return SourceTreeFixture.createAsync({
      [ModuleDeclarationTests.PACKAGE_FILE]: JSON.stringify({ ...ModuleDeclarationTests.BASE, parts }),
      [ModuleDeclarationTests.PACKAGE_MANIFEST]: JSON.stringify({ name: ModuleDeclarationTests.PACKAGE, version: "0.0.1", exports })
    });
  }

  @TestMethod
  public async writesFormerNamesToTheDeclarationsAndADocumentsFormerNamesToItsWindowPartSource(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    await app.writeDeclarationAsync({
      contributes: { commands: ["sample.go"], documents: ["sample.page"], formerNames: { "sample.go": ["sample.run"], "sample.page": ["sample.sheet", "old.page"] } }
    }, ["runtime", "window"]);
    await app.writeTreeModuleAsync("clock", ["runtime"], {});

    await ModuleDeclarationTests.runAsync(app, await app.writeNpmAsync());

    const modules = JsonReader.parse(await readFile(path.join(app.path, "_build", "modules", "declarations.json"), "utf8")).readObjectArray("modules");
    Assert.areEqual(
      JSON.stringify([["clock", null], ["sample", { "sample.go": ["sample.run"], "sample.page": ["sample.sheet", "old.page"] }]]),
      JSON.stringify(modules.map(t => [t.readString("id"), t.hasField("formerNames") ? t.readValue("formerNames") : null]).sort()));
    Assert.isTrue(modules.every(t => !t.readObject("contributes").hasField("formerNames")));
    const sources = await readFile(path.join(app.path, "_build", "generated", "window-parts.ts"), "utf8");
    Assert.isTrue(sources.includes(".then(t => t.windowPart), [], [], [], [[\"sample.sheet\",\"sample.page\"],[\"old.page\",\"sample.page\"]])"), sources);
  }

  @TestMethod
  @TestData("[\"sample.run\"]", "must give its former names as an object from a command's or a document's name to the names it had before")
  @TestData("{ \"sample.face\": [\"sample.run\"] }", "gives former names for \"sample.face\", which isn't one of its commands or documents")
  @TestData("{ \"sample.gone\": [\"sample.run\"] }", "gives former names for \"sample.gone\", which isn't one of its commands or documents")
  @TestData("{ \"sample.go\": [] }", "must give \"sample.go\" its former names as a list of different qualified names, such as \"notes.add\", none of them its own name")
  @TestData("{ \"sample.go\": \"sample.run\" }", "must give \"sample.go\" its former names as a list of different qualified names, such as \"notes.add\", none of them its own name")
  @TestData("{ \"sample.go\": [\"sample.go\"] }", "must give \"sample.go\" its former names as a list of different qualified names, such as \"notes.add\", none of them its own name")
  @TestData("{ \"sample.go\": [\"sample.run\", \"sample.run\"] }", "must give \"sample.go\" its former names as a list of different qualified names, such as \"notes.add\", none of them its own name")
  @TestData("{ \"sample.go\": [\"Sample.Run\"] }", "must give \"sample.go\" its former names as a list of different qualified names, such as \"notes.add\", none of them its own name")
  @TestData("{ \"sample.go\": [7] }", "must give \"sample.go\" its former names as a list of different qualified names, such as \"notes.add\", none of them its own name")
  @TestData("{ \"sample.go\": [\"sample.run\", \"desktop.closeTab\"] }", "gives \"sample.go\" the former name \"desktop.closeTab\", which belongs to the shell or a reserved id: desktop, status, commands, run, open, quit, help")
  @TestData("{ \"sample.go\": [\"help.show\"] }", "gives \"sample.go\" the former name \"help.show\", which belongs to the shell or a reserved id: desktop, status, commands, run, open, quit, help")
  public async refusesFormerNamesThatArentAMapFromItsCommandsAndDocumentsToOtherQualifiedNames(formerNames: string, problem: string): Promise<void> {
    await ModuleDeclarationTests.assertOutputAsync(
      { contributes: { commands: ["sample.go"], views: ["sample.face"], formerNames: JSON.parse(formerNames) } }, ["runtime", "window"], `${ModuleDeclarationTests.DECLARATION}${problem}.\n`);
  }

  private static async runAsync(app: ModuleAppFixture, environment: NodeJS.ProcessEnv = {}): Promise<string> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    await new BuildCommandLine(app.path, environment, process.platform, process.arch, output, new PassThrough()).runAsync(["build"]);
    return chunks.join(String.empty);
  }

  private static async assertOutputAsync(fields: Readonly<Record<string, unknown>>, parts: readonly string[], ending: string): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeDeclarationAsync(fields, parts);

    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    await new BuildCommandLine(app.path, {}, process.platform, process.arch, output, new PassThrough()).runAsync(["build"]);
    const text = chunks.join(String.empty);

    Assert.isTrue(text.endsWith(ending), text);
  }
}
