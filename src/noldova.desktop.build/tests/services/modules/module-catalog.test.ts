/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { type JsonObject, JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { BuildCommandLine } from "@noldova/desktop.build";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { ModuleCatalog } from "../../../src/services/modules/module-catalog.js";
import { ModuleAppFixture } from "../../fixtures/module-app.fixture.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class ModuleCatalogTests {
  private static readonly VERSION: string = "0.0.1";
  private static readonly OTHER: string = "0.0.3";
  private static readonly ABSENT: string = "sample-optional-peer";
  private static readonly ANGULAR_RANGE: string = ">=22.0.0 <23.0.0";
  private static readonly LATER_ANGULAR_RANGE: string = ">=22.2.2 <23.0.0";
  private static readonly WIDE_ANGULAR_RANGE: string = ">=22.0.0 <24.0.0";
  private static readonly NARROW_ANGULAR_RANGE: string = ">=22.0.0 <22.3.0";
  private static readonly ORGANIZATION_PEER: string = "@noldova/git.window";
  private static readonly ORGANIZATION_VERSION: string = "0.0.5";
  private static readonly ORGANIZATION_RANGE: string = ">=0.0.5 <0.1.0";
  private static readonly LATER_ORGANIZATION_RANGE: string = ">=0.0.6 <0.1.0";
  private static readonly RANGE_RULE: string =
    "; a peer names one exact version, such as 1.2.3, or, for the organization's packages, a range of the form >=<lowest version> <first version refused>, such as >=0.0.70 <0.1.0, "
    + "and, for Angular's packages in a window part, >=<the Angular it builds with> <the next Angular major>, such as >=22.2.5 <23.0.0.\n";
  private static readonly NO_PRODUCT: string = "The root package.json must declare desktop.product.\n";
  private static readonly CONTEXT: string = "@noldova/context.core";
  private static readonly OTHER_MODULE: string = "@noldova/desktop.clock.runtime";
  private static readonly ALIAS: string = "@sample/alias";
  private static readonly OWN_TREE: readonly string[] = ["node_modules", ...ModuleAppFixture.MODULE_PACKAGE.split("/")];
  private static readonly OWN_FOLDER: string = `node_modules/${ModuleAppFixture.MODULE_PACKAGE}`;
  private static readonly RANGE: string = ">=0.0.4 <0.1.0";
  private static readonly DECLARATION: string = "node_modules/@noldova/sample/module.json";
  private static readonly SAMPLE: string = `sample's package ${ModuleAppFixture.MODULE_PACKAGE}`;
  private static readonly KIT: string = "@noldova/ui.components.angular";
  private static readonly OTHER_PEER: string = "sample-optional-peer";
  private static readonly PEER_RULE: string =
    "; a peer names one exact version, such as 1.2.3, or, for the organization's packages, a range of the form >=<lowest version> <first version refused>, such as >=0.0.70 <0.1.0, "
    + "and, for Angular's packages in a window part, >=<the Angular it builds with> <the next Angular major>, such as >=22.2.5 <23.0.0.\n";
  private static readonly OPTIONAL_DECLARATION: string = "node_modules/@noldova/sample/module.json ";
  private static readonly WINDOW_SUBJECT: string = `sample's window part package ${ModuleAppFixture.WINDOW_PACKAGE}`;
  private static readonly WINDOW_PIN_INVALID: string =
    `${ModuleCatalogTests.WINDOW_SUBJECT} must be pinned to one exact version among ${ModuleAppFixture.MODULE_PACKAGE}'s dependencies, and installed at it; run npm install.`;
  private static readonly INVALID_NAME: string =
    "The root package.json's desktop.product.name must be a name without quotes, backslashes or line breaks.\n";

  @TestMethod
  public async readsTheDeclarationsOfModulesAndFixtureModulesAndReportsInvalidOnesAsProblems(): Promise<void> {
    await using empty = await SourceTreeFixture.createAsync();
    await using tree = await SourceTreeFixture.createAsync({
      "src/modules/tasks/module.json": ModuleCatalogTests.declare("tasks", []),
      "src/modules/notes/module.json": ModuleCatalogTests.declare("notes", ["tasks"]),
      "src/modules/notes.md": "# Notes\n",
      "src/modules/drafts/README.md": "# Drafts\n",
      "src/modules/broken/module.json": "{",
      [`${Resources.moduleFixtureFolder}/clock/module.json`]: ModuleCatalogTests.declare("clock", [])
    });

    const none = await new ModuleCatalog(empty.path).readAllAsync();
    const inventory = await new ModuleCatalog(tree.path).readAllAsync();

    Assert.areEqual(0, none.declarations.length);
    Assert.areEqual(0, none.problems.length);
    Assert.areEqual("notes:false, tasks:false, clock:true", inventory.declarations.map(t => `${t.id}:${t.isFixture}`).join(", "));
    Assert.areEqual("src/modules/broken/module.json could not be read as JSON.", inventory.problems.join("\n"));
  }

  @TestMethod
  public async listsFixtureModulesOnlyInATestBuildAndLeavesOutTheNamedOnes(): Promise<void> {
    await using tree = await ModuleCatalogTests.createAsync();
    const catalog = new ModuleCatalog(tree.path);

    const regular = await catalog.listBuildAsync(false, []);
    const tested = await catalog.listBuildAsync(true, []);
    const without = await catalog.listBuildAsync(true, ["clock", "weather"]);

    Assert.areEqual("tasks, notes", regular.map(t => t.id).join(", "));
    Assert.areEqual("tasks, weather, notes, clock", tested.map(t => t.id).join(", "));
    Assert.areEqual("tasks, notes", without.map(t => t.id).join(", "));
  }

  @TestMethod
  public async refusesToLeaveOutAModuleAFixtureModuleDependsOn(): Promise<void> {
    await using tree = await ModuleCatalogTests.createAsync();

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(true, ["notes"]), BuildException);

    Assert.areEqual("clock depends on notes, which the build does not include.", error.message);
  }

  @TestMethod
  public async refusesToLeaveOutAModuleTheBuildDoesNotHave(): Promise<void> {
    await using tree = await ModuleCatalogTests.createAsync();

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, ["clock", "radio"]), BuildException);

    Assert.areEqual("The build has no module clock, radio to leave out.", error.message);
  }

  @TestMethod
  public async refusesAFixtureModuleWhoseIdRepeatsAModulesOfTheTestBuild(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ desktop: { modules: ["clock"] } }),
      "src/modules/clock/module.json": ModuleCatalogTests.declare("clock", []),
      [`${Resources.moduleFixtureFolder}/clock/module.json`]: ModuleCatalogTests.declare("clock", [])
    });
    const catalog = new ModuleCatalog(tree.path);

    Assert.areEqual("clock", (await catalog.listBuildAsync(false, [])).map(t => t.id).join(", "));
    const error = await Assert.throwsAsync(() => catalog.listBuildAsync(true, []), BuildException);

    Assert.areEqual(`Module ids repeat in the build: src/modules/clock, ${Resources.moduleFixtureFolder}/clock.`, error.message);
  }

  @TestMethod
  public async refusesARootManifestWithoutAListOfModules(): Promise<void> {
    const messages: string[] = [];
    for (const manifest of [{}, { desktop: {} }, { desktop: { modules: "notes" } }]) {
      await using tree = await SourceTreeFixture.createAsync({ "package.json": JSON.stringify(manifest) });
      messages.push((await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException)).message);
    }

    Assert.areEqual(JSON.stringify(Array(3).fill(Resources.moduleListRequired)), JSON.stringify(messages));
  }

  @TestMethod
  public async refusesAPackagedModuleThatTheRootManifestDoesNotPinToAnExactVersion(): Promise<void> {
    const messages: string[] = [];
    for (const dependencies of [{}, { "@sample/notes": "^0.0.1" }]) {
      await using tree = await SourceTreeFixture.createAsync({
        "package.json": JSON.stringify({ dependencies, desktop: { modules: [{ id: "notes", package: "@sample/notes" }] } })
      });
      messages.push((await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException)).message);
    }

    Assert.areEqual(JSON.stringify(Array(2).fill(Resources.formatCatalogPinMissing("notes", "@sample/notes"))), JSON.stringify(messages));
  }

  @TestMethod
  public async refusesAFixturePackageWhoseDeclarationGivesNoVersion(): Promise<void> {
    const file = `${Resources.formatFolderFile(Resources.modulePackageFixturesFolder, "radio")}/module.json`;
    const messages: string[] = [];
    for (const text of ["{", JSON.stringify({ id: "radio" })]) {
      await using tree = await SourceTreeFixture.createAsync({ [file]: text });
      messages.push((await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listFixturePackagesAsync(), BuildException)).message);
    }

    Assert.areEqual(`${file} could not be read as JSON.\n${file} must have a version, which its package takes.`, messages.join("\n"));
  }

  @TestMethod
  public async checksAModulePackagesNoldovaDesktopPeerAgainstTheAppsInstalledVersion(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleCatalogTests.OTHER, ModuleAppFixture.NEEDED);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`sample's package ${ModuleAppFixture.MODULE_PACKAGE} needs ${ModuleAppFixture.RUNTIME} ${ModuleAppFixture.NEEDED}, `
      + `but the app has ${ModuleCatalogTests.OTHER}${ModuleCatalogTests.RANGE_RULE}`), output);
  }

  @TestMethod
  public async checksAWindowPartPackagesNoldovaDesktopPeerAgainstTheWindowWorkspacesVersion(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleCatalogTests.OTHER);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`sample's window part package ${ModuleAppFixture.WINDOW_PACKAGE} needs ${ModuleAppFixture.WINDOW} ${ModuleAppFixture.NEEDED}, `
      + `but the app's install has ${ModuleCatalogTests.OTHER}${ModuleCatalogTests.RANGE_RULE}`), output);
  }

  @TestMethod
  public async acceptsAWindowPartPackagesAngularPeerAsARangeUpToTheNextMajorThatHoldsTheWindowWorkspacesAngular(): Promise<void> {
    await using app = await ModuleCatalogTests.createWithAngularPeerAsync(ModuleCatalogTests.ANGULAR_RANGE);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(ModuleCatalogTests.NO_PRODUCT), output);
  }

  @TestMethod
  public async refusesAWindowPartPackagesAngularRangeThatDoesNotHoldTheWindowWorkspacesAngular(): Promise<void> {
    await using app = await ModuleCatalogTests.createWithAngularPeerAsync(ModuleCatalogTests.LATER_ANGULAR_RANGE);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`sample's window part package ${ModuleAppFixture.WINDOW_PACKAGE} needs ${ModuleAppFixture.ANGULAR_CORE} ${ModuleCatalogTests.LATER_ANGULAR_RANGE}, `
      + `but the app's install has ${ModuleAppFixture.ANGULAR_VERSION}${ModuleCatalogTests.RANGE_RULE}`), output);
  }

  @TestMethod
  public async refusesAWindowPartPackagesAngularRangeThatDoesNotEndAtTheNextMajor(): Promise<void> {
    for (const range of [ModuleCatalogTests.WIDE_ANGULAR_RANGE, ModuleCatalogTests.NARROW_ANGULAR_RANGE]) {
      await using app = await ModuleCatalogTests.createWithAngularPeerAsync(range);

      const output = await ModuleCatalogTests.runAsync(app);

      Assert.isTrue(output.endsWith(`sample's window part package ${ModuleAppFixture.WINDOW_PACKAGE} needs ${ModuleAppFixture.ANGULAR_CORE} ${range}, `
        + "a range that doesn't end at the next major after 22.0.0; an Angular peer takes >=<the Angular it builds with> <the next Angular major>, such as >=22.2.5 <23.0.0, "
        + "since only a new Angular major may break a module.\n"), output);
    }
  }

  @TestMethod
  public async acceptsAPeerOnAnotherOfTheOrganizationsPackagesAsTheStandardsRangeThatHoldsTheInstalledVersionOrAtThatExactVersion(): Promise<void> {
    for (const needed of [ModuleCatalogTests.ORGANIZATION_RANGE, ModuleCatalogTests.ORGANIZATION_VERSION])
      for (const isWindowPart of [false, true]) {
        await using app = await ModuleCatalogTests.createWithOrganizationPeerAsync(needed, isWindowPart);

        const output = await ModuleCatalogTests.runAsync(app);

        Assert.isTrue(output.endsWith(ModuleCatalogTests.NO_PRODUCT), output);
      }
  }

  @TestMethod
  public async refusesAPeerOnAnotherOfTheOrganizationsPackagesInARangeOrAtAVersionThatMissesTheInstalledVersion(): Promise<void> {
    const parts: readonly (readonly [boolean, string, string])[] = [[false, ModuleCatalogTests.SAMPLE, "the app has"], [true, ModuleCatalogTests.WINDOW_SUBJECT, "the app's install has"]];
    for (const needed of [ModuleCatalogTests.LATER_ORGANIZATION_RANGE, ModuleAppFixture.NEEDED])
      for (const [isWindowPart, subject, holder] of parts) {
        await using app = await ModuleCatalogTests.createWithOrganizationPeerAsync(needed, isWindowPart);

        const output = await ModuleCatalogTests.runAsync(app);

        Assert.isTrue(output.endsWith(`${subject} needs ${ModuleCatalogTests.ORGANIZATION_PEER} ${needed}, `
          + `but ${holder} ${ModuleCatalogTests.ORGANIZATION_VERSION}${ModuleCatalogTests.RANGE_RULE}`), output);
      }
  }

  @TestMethod
  public async refusesAPeerOnAnotherOfTheOrganizationsPackagesInARangeThatDoesNotEndAtTheFirstVersionRefused(): Promise<void> {
    for (const needed of [">=0.0.5 <0.2.0", ">=0.0.5 <1.0.0", ">=1.2.0 <1.3.0"]) {
      await using app = await ModuleCatalogTests.createWithOrganizationPeerAsync(needed, false);

      const output = await ModuleCatalogTests.runAsync(app);

      Assert.isTrue(output.endsWith(`${ModuleCatalogTests.SAMPLE} needs ${ModuleCatalogTests.ORGANIZATION_PEER} ${needed}, a range that doesn't end at the first version refused after `
        + `${needed.slice(2, needed.indexOf(" "))}, the next minor below 1.0.0 and the next major from it; a peer on another of the organization's packages takes `
        + ">=<lowest version> <first version refused>, such as >=0.0.70 <0.1.0.\n"), output);
    }
  }

  @TestMethod
  public async refusesAWindowPartPackagesPeerInAnotherRangeFormOrARangeOnAPackageThatTakesNone(): Promise<void> {
    const cases: readonly (readonly [string, string])[] = [[ModuleAppFixture.ANGULAR_CORE, `^${ModuleAppFixture.ANGULAR_VERSION}`], [ModuleCatalogTests.ABSENT, ModuleCatalogTests.ANGULAR_RANGE]];
    for (const [peer, needed] of cases) {
      await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
      await app.editInstalledManifestAsync(ModuleAppFixture.WINDOW_PACKAGE, {
        peerDependencies: { [ModuleAppFixture.ANGULAR_CORE]: ModuleAppFixture.ANGULAR_VERSION, [ModuleAppFixture.WINDOW]: ModuleAppFixture.NEEDED, [peer]: needed }
      });

      const output = await ModuleCatalogTests.runAsync(app);

      Assert.isTrue(output.endsWith(`sample's window part package ${ModuleAppFixture.WINDOW_PACKAGE} needs ${peer} ${needed}, `
        + `but the app's install has ${peer === ModuleAppFixture.ANGULAR_CORE ? ModuleAppFixture.ANGULAR_VERSION : "none"}${ModuleCatalogTests.RANGE_RULE}`), output);
    }
  }

  @TestMethod
  public async checksANoldovaDesktopPeerTheBuildBuildsAgainstTheBuiltVersionOverTheInstalledOne(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleCatalogTests.OTHER, true);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isFalse(output.includes(ModuleAppFixture.BUILT_PART) || output.includes(ModuleAppFixture.BUILT_WINDOW_PART), output);
    Assert.isTrue(output.endsWith(`but the app's install has ${ModuleCatalogTests.OTHER}${ModuleCatalogTests.RANGE_RULE}`), output);
  }

  @TestMethod
  public async passesTheModuleChecksWhenEveryPeerIsAtTheAppsInstalledVersion(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(ModuleCatalogTests.NO_PRODUCT), output);
  }

  @TestMethod
  public async skipsAModulePackagesOptionalPeerTheAppDoesNotHave(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, {
      peerDependencies: { [ModuleAppFixture.RUNTIME]: ModuleAppFixture.NEEDED, [ModuleCatalogTests.ABSENT]: ModuleAppFixture.NEEDED },
      peerDependenciesMeta: { [ModuleCatalogTests.ABSENT]: { optional: true } }
    });

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(ModuleCatalogTests.NO_PRODUCT), output);
  }

  @TestMethod
  public async refusesAModulePackagesRequiredPeerTheAppDoesNotHave(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, {
      peerDependencies: { [ModuleAppFixture.RUNTIME]: ModuleAppFixture.NEEDED, [ModuleCatalogTests.ABSENT]: ModuleAppFixture.NEEDED },
      peerDependenciesMeta: { [ModuleCatalogTests.ABSENT]: { optional: false } }
    });

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`sample's package ${ModuleAppFixture.MODULE_PACKAGE} needs ${ModuleCatalogTests.ABSENT} ${ModuleAppFixture.NEEDED}, `
      + `but the app has none${ModuleCatalogTests.RANGE_RULE}`), output);
  }

  @TestMethod
  public async refusesAModulePackagesOptionalPeerTheAppHasAtAnotherVersion(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleCatalogTests.OTHER, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, { peerDependenciesMeta: { [ModuleAppFixture.RUNTIME]: { optional: true } } });

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`sample's package ${ModuleAppFixture.MODULE_PACKAGE} needs ${ModuleAppFixture.RUNTIME} ${ModuleAppFixture.NEEDED}, `
      + `but the app has ${ModuleCatalogTests.OTHER}${ModuleCatalogTests.RANGE_RULE}`), output);
  }

  @TestMethod
  public async refusesAModulePackagesOptionalPeerTheAppDoesNotHaveWrittenAsARange(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, {
      peerDependencies: { [ModuleAppFixture.RUNTIME]: ModuleAppFixture.NEEDED, [ModuleCatalogTests.ABSENT]: `^${ModuleAppFixture.NEEDED}` },
      peerDependenciesMeta: { [ModuleCatalogTests.ABSENT]: { optional: true } }
    });

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`sample's package ${ModuleAppFixture.MODULE_PACKAGE} needs ${ModuleCatalogTests.ABSENT} ^${ModuleAppFixture.NEEDED}, `
      + `but the app has none${ModuleCatalogTests.RANGE_RULE}`), output);
  }

  @TestMethod
  public async refusesAModulePackagesOptionalAngularPeerWrittenAsARangeThatOnlyAWindowPartTakes(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, {
      peerDependencies: { [ModuleAppFixture.RUNTIME]: ModuleAppFixture.NEEDED, [ModuleAppFixture.ANGULAR_CORE]: ModuleCatalogTests.ANGULAR_RANGE },
      peerDependenciesMeta: { [ModuleAppFixture.ANGULAR_CORE]: { optional: true } }
    });

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`sample's package ${ModuleAppFixture.MODULE_PACKAGE} needs ${ModuleAppFixture.ANGULAR_CORE} ${ModuleCatalogTests.ANGULAR_RANGE}, `
      + `but the app has ${ModuleAppFixture.ANGULAR_VERSION}${ModuleCatalogTests.RANGE_RULE}`), output);
  }

  @TestMethod
  public async refusesAModulePackageThatNamesNoldovaDesktopsWindowPackageAsAPeer(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, {
      peerDependencies: { [ModuleAppFixture.RUNTIME]: ModuleAppFixture.NEEDED, [ModuleAppFixture.WINDOW]: ModuleAppFixture.NEEDED },
      peerDependenciesMeta: { [ModuleAppFixture.WINDOW]: { optional: true } }
    });

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`sample's package ${ModuleAppFixture.MODULE_PACKAGE} names ${ModuleAppFixture.WINDOW} as a peer, which a module's package never does: `
      + "the registry serves no peerDependenciesMeta, so npm takes even an optional peer as required "
      + `and installs ${ModuleAppFixture.WINDOW} at the app's root, where its exact Angular peers clash with a newer Angular; `
      + "the module's window part package names it instead.\n"), output);
  }

  @TestMethod
  public async buildsAnAppWithoutARootLockfileOrBaseTypeScriptSettings(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleCatalogTests.OTHER);
    await app.removeRootInputsAsync();

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`but the app's install has ${ModuleCatalogTests.OTHER}${ModuleCatalogTests.RANGE_RULE}`), output);
  }

  @TestMethod
  public async takesAnotherModulesPackageAmongADependenciesAsNotACopyOfNoldovaDesktops(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.installPackageAsync([], ModuleCatalogTests.OTHER_MODULE, ModuleCatalogTests.OTHER_MODULE);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, {
      dependencies: {
        [ModuleAppFixture.RUNTIME_PACKAGE]: ModuleAppFixture.MODULE_VERSION,
        [ModuleAppFixture.WINDOW_PACKAGE]: ModuleAppFixture.MODULE_VERSION,
        [ModuleCatalogTests.OTHER_MODULE]: ModuleAppFixture.MODULE_VERSION
      }
    });

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(ModuleCatalogTests.NO_PRODUCT), output);
  }

  @TestMethod
  public async refusesADependencyThatInstallsContextsPackageUnderAnNpmAlias(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.installPackageAsync([], ModuleCatalogTests.ALIAS, ModuleCatalogTests.CONTEXT);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, {
      dependencies: {
        [ModuleAppFixture.RUNTIME_PACKAGE]: ModuleAppFixture.MODULE_VERSION,
        [ModuleAppFixture.WINDOW_PACKAGE]: ModuleAppFixture.MODULE_VERSION,
        [ModuleCatalogTests.ALIAS]: `npm:${ModuleCatalogTests.CONTEXT}@1.0.0`
      }
    });

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.includes(`${ModuleCatalogTests.OWN_FOLDER} lists ${ModuleCatalogTests.ALIAS} among its dependencies, which installs ${ModuleCatalogTests.CONTEXT};`), output);
  }

  @TestMethod
  public async refusesACopyInsideTheModulesPackageThatIsInstalledUnderAnotherName(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.installPackageAsync(ModuleCatalogTests.OWN_TREE, "renamed", ModuleCatalogTests.CONTEXT);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.includes(`it holds its own copy of ${ModuleCatalogTests.CONTEXT} at ${ModuleCatalogTests.OWN_FOLDER}/node_modules/renamed;`), output);
  }

  @TestMethod
  public async refusesACopyInsideTheModulesPackageThatIsALinkToAFolder(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.linkPackageAsync(ModuleCatalogTests.OWN_TREE, "linked", ModuleAppFixture.RUNTIME);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.includes(`it holds its own copy of ${ModuleAppFixture.RUNTIME} at ${ModuleCatalogTests.OWN_FOLDER}/node_modules/linked;`), output);
  }

  @TestMethod
  public async acceptsAPackageInsideTheModulesPackageThatIsNotNoldovaDesktopsDespiteItsScope(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.installPackageAsync(ModuleCatalogTests.OWN_TREE, ModuleCatalogTests.OTHER_MODULE, ModuleCatalogTests.OTHER_MODULE);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(ModuleCatalogTests.NO_PRODUCT), output);
  }

  @TestMethod
  public async takesAPackageWhoseManifestCannotBeReadForTheFolderItIsInstalledIn(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeFileAsync([...ModuleCatalogTests.OWN_TREE, "node_modules", "broken", "package.json"], "{");

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(ModuleCatalogTests.NO_PRODUCT), output);
  }

  @TestMethod
  public async refusesADependencyOnTheWindowPartsNameThatInstallsAnotherPackage(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.installPackageAsync([], ModuleAppFixture.WINDOW_PACKAGE, ModuleCatalogTests.CONTEXT);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.includes(`${ModuleCatalogTests.OWN_FOLDER} lists ${ModuleAppFixture.WINDOW_PACKAGE} among its dependencies, which installs ${ModuleCatalogTests.CONTEXT};`), output);
  }

  @TestMethod
  public async writesTheNoldovaDesktopVersionsAModuleAcceptsAndTheAppsNoldovaDesktopToTheDeclarations(): Promise<void> {
    await using app = await ModuleCatalogTests.createRangedAsync();
    await app.writeProductAsync();
    await app.writeTreeModuleAsync("clock", ["runtime"], {});

    await ModuleCatalogTests.runAsync(app, await app.writeNpmAsync());

    const document = await ModuleCatalogTests.readDeclarationsAsync(app);
    Assert.areEqual(ModuleAppFixture.NEEDED, document.readString("noldovaDesktop"));
    Assert.areEqual(
      `clock|false|,sample|true|${ModuleCatalogTests.RANGE}`,
      ModuleCatalogTests.readModules(document).map(t => `${String(t["id"])}|${String(Object.hasOwn(t, "noldovaDesktop"))}|${String(t["noldovaDesktop"] ?? String.empty)}`).sort().join(","));
  }

  @TestMethod
  public async writesNoNoldovaDesktopVersionToTheDeclarationsOfAnAppWithoutNoldovaDesktopsRuntime(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, { peerDependenciesMeta: { [ModuleAppFixture.RUNTIME]: { optional: true } } });
    await rm(path.join(app.path, "node_modules", ...ModuleAppFixture.RUNTIME.split("/")), { recursive: true });
    await app.writeProductAsync();

    await ModuleCatalogTests.runAsync(app, await app.writeNpmAsync());

    Assert.isFalse((await ModuleCatalogTests.readDeclarationsAsync(app)).hasField("noldovaDesktop"));
  }

  @TestMethod
  @TestData("\"0.0.4\"")
  @TestData("\">=0.0.4\"")
  @TestData("\"^0.0.4\"")
  @TestData("\">=0.0.4 <=0.1.0\"")
  @TestData("\">= 0.0.4 <0.1.0\"")
  @TestData("\">=0.0.4 <0.0.4\"")
  @TestData("\">=0.1.0 <0.0.4\"")
  @TestData("\">=0.0.04 <0.1.0\"")
  @TestData("4")
  @TestData("null")
  public async refusesNoldovaDesktopVersionsThatAreNotOneRangeFromALowestVersionBelowAFirstRefusedOne(value: string): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeDeclarationAsync({ noldovaDesktop: JSON.parse(value) }, ["runtime", "window"]);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleCatalogTests.DECLARATION} must name the Noldova Desktop versions it accepts as its noldovaDesktop, in the one form `
      + `>=<lowest version> <first version refused>, such as >=0.0.70 <0.1.0, not ${value}.\n`), output);
  }

  @TestMethod
  @TestData(">=0.0.5 <0.1.0")
  @TestData(">=0.0.1 <0.0.4")
  public async refusesAModuleThatDoesNotAcceptTheAppsNoldovaDesktopAndNamesBothVersions(range: string): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await ModuleCatalogTests.writeRangedTreeModuleAsync(app, range);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`clock ${ModuleAppFixture.MODULE_VERSION} accepts Noldova Desktop ${range}, but the app has Noldova Desktop ${ModuleAppFixture.NEEDED}, as ${ModuleAppFixture.RUNTIME} shows.\n`), output);
  }

  @TestMethod
  public async refusesAModuleThatNamesNoldovaDesktopVersionsInAnAppWithoutNoldovaDesktopsRuntime(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, { peerDependenciesMeta: { [ModuleAppFixture.RUNTIME]: { optional: true } } });
    await rm(path.join(app.path, "node_modules", ...ModuleAppFixture.RUNTIME.split("/")), { recursive: true });
    await ModuleCatalogTests.writeRangedTreeModuleAsync(app, ModuleCatalogTests.RANGE);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`clock ${ModuleAppFixture.MODULE_VERSION} accepts Noldova Desktop ${ModuleCatalogTests.RANGE}, but the app has no Noldova Desktop, as ${ModuleAppFixture.RUNTIME} shows.\n`), output);
  }

  @TestMethod
  public async refusesANoldovaDesktopPeerAtAnotherRangeThanTheModuleAccepts(): Promise<void> {
    await using app = await ModuleCatalogTests.createRangedAsync();
    await ModuleCatalogTests.writePeerAsync(app, ModuleAppFixture.MODULE_PACKAGE, ModuleAppFixture.RUNTIME, ">=0.0.1 <0.1.0");

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleCatalogTests.SAMPLE} needs ${ModuleAppFixture.RUNTIME} >=0.0.1 <0.1.0, but ${ModuleCatalogTests.DECLARATION} accepts Noldova Desktop `
      + `${ModuleCatalogTests.RANGE}; each of Noldova Desktop's packages it peers on takes that same range.\n`), output);
  }

  @TestMethod
  public async refusesAnExactNoldovaDesktopPeerOfAModuleThatAcceptsARange(): Promise<void> {
    await using app = await ModuleCatalogTests.createRangedAsync();
    await ModuleCatalogTests.writePeerAsync(app, ModuleAppFixture.WINDOW_PACKAGE, ModuleAppFixture.WINDOW, ModuleAppFixture.NEEDED);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`sample's window part package ${ModuleAppFixture.WINDOW_PACKAGE} needs ${ModuleAppFixture.WINDOW} ${ModuleAppFixture.NEEDED}, but ${ModuleCatalogTests.DECLARATION} `
      + `accepts Noldova Desktop ${ModuleCatalogTests.RANGE}; each of Noldova Desktop's packages it peers on takes that same range.\n`), output);
  }

  @TestMethod
  public async refusesANoldovaDesktopPeerRangeOfAModuleThatNamesNoNoldovaDesktop(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await ModuleCatalogTests.writePeerAsync(app, ModuleAppFixture.MODULE_PACKAGE, ModuleAppFixture.RUNTIME, ModuleCatalogTests.RANGE);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleCatalogTests.SAMPLE} needs ${ModuleAppFixture.RUNTIME} ${ModuleCatalogTests.RANGE}, a range, but ${ModuleCatalogTests.DECLARATION} `
      + "names no noldovaDesktop; a module that accepts a range of Noldova Desktop versions names it there, and each of Noldova Desktop's packages it peers on takes that same range.\n"), output);
  }

  @TestMethod
  public async refusesAModuleWhoseRangedNoldovaDesktopPeerTheAppDoesNotMeet(): Promise<void> {
    await using app = await ModuleCatalogTests.createRangedAsync();
    await app.writeDeclarationAsync({ noldovaDesktop: ">=0.0.5 <0.1.0" }, ["runtime", "window"]);
    await ModuleCatalogTests.writePeerAsync(app, ModuleAppFixture.MODULE_PACKAGE, ModuleAppFixture.RUNTIME, ">=0.0.5 <0.1.0");

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleCatalogTests.SAMPLE} needs ${ModuleAppFixture.RUNTIME} >=0.0.5 <0.1.0, but the app has ${ModuleAppFixture.NEEDED}${ModuleCatalogTests.PEER_RULE}`), output);
  }

  @TestMethod
  public async passesARangedPeerOnTheKitThatTheWindowWorkspacesVersionMeets(): Promise<void> {
    await using app = await ModuleCatalogTests.createKitPeerAsync(">=1.0.0 <2.0.0", "1.2.3");
    await app.writeProductAsync();

    const output = await ModuleCatalogTests.runAsync(app, await app.writeNpmAsync());

    Assert.isFalse(output.includes(`needs ${ModuleCatalogTests.KIT}`), output);
    Assert.isTrue(output.includes("Modules in the build: 1."), output);
  }

  @TestMethod
  @TestData(">=1.0.0 <1.2.3", "1.2.3")
  @TestData(">=1.2.4 <2.0.0", "1.2.3")
  @TestData(">=1.0.0 <2.0.0", String.empty)
  @TestData(">=1.0.0 <2.0.0", "1.2.3-rc.1")
  public async refusesARangedPeerOnTheKitThatTheWindowWorkspacesVersionDoesNotMeet(range: string, installed: string): Promise<void> {
    await using app = await ModuleCatalogTests.createKitPeerAsync(range, installed);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`sample's window part package ${ModuleAppFixture.WINDOW_PACKAGE} needs ${ModuleCatalogTests.KIT} ${range}, `
      + `but the app's install has ${installed === String.empty ? "none" : installed}${ModuleCatalogTests.PEER_RULE}`), output);
  }

  @TestMethod
  public async skipsAnOptionalRangedPeerOnContextThatTheAppDoesNotHave(): Promise<void> {
    await using app = await ModuleCatalogTests.createContextPeerAsync(true);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isFalse(output.includes(`needs ${ModuleCatalogTests.CONTEXT}`), output);
  }

  @TestMethod
  public async refusesARequiredRangedPeerOnContextThatTheAppDoesNotHave(): Promise<void> {
    await using app = await ModuleCatalogTests.createContextPeerAsync(false);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleCatalogTests.SAMPLE} needs ${ModuleCatalogTests.CONTEXT} >=1.0.0 <2.0.0, but the app has none${ModuleCatalogTests.PEER_RULE}`), output);
  }

  @TestMethod
  public async refusesARangedPeerOnAPackageOtherThanNoldovaDesktopsContextsOrTheKitsEvenAnOptionalOneTheAppDoesNotHave(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, {
      peerDependencies: { [ModuleAppFixture.RUNTIME]: ModuleAppFixture.NEEDED, [ModuleCatalogTests.OTHER_PEER]: ModuleCatalogTests.RANGE },
      peerDependenciesMeta: { [ModuleCatalogTests.OTHER_PEER]: { optional: true } }
    });

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleCatalogTests.SAMPLE} needs ${ModuleCatalogTests.OTHER_PEER} ${ModuleCatalogTests.RANGE}, but the app has none${ModuleCatalogTests.PEER_RULE}`), output);
  }

  @TestMethod
  public async acceptsAnOptionalDependencyTheBuildLeavesOut(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeDeclarationAsync({ optionalDependencies: { tasks: "1.0.0" } }, ["runtime", "window"]);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(ModuleCatalogTests.NO_PRODUCT), output);
  }

  @TestMethod
  public async acceptsAnOptionalDependencyTheBuildIncludesAtTheVersionItNeeds(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeDeclarationAsync({ optionalDependencies: { clock: ModuleAppFixture.MODULE_VERSION } }, ["runtime", "window"]);
    await app.writeTreeModuleAsync("clock", ["runtime"], {});

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(ModuleCatalogTests.NO_PRODUCT), output);
  }

  @TestMethod
  public async writesEachModulesOptionalDependenciesToTheDeclarationsAndNamesThoseTheBuildLeavesOut(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    await app.writeDeclarationAsync({ optionalDependencies: { clock: ModuleAppFixture.MODULE_VERSION, tasks: "1.0.0" } }, ["runtime", "window"]);
    await app.writeTreeModuleAsync("clock", ["runtime"], {});

    const output = await ModuleCatalogTests.runAsync(app, await app.writeNpmAsync());

    const modules = JsonReader.parse(await readFile(path.join(app.path, "_build", "modules", "declarations.json"), "utf8")).readObjectArray("modules");
    Assert.areEqual(
      JSON.stringify([["clock", false, null], ["sample", true, { clock: ModuleAppFixture.MODULE_VERSION, tasks: "1.0.0" }]]),
      JSON.stringify(modules.map(t => [t.readString("id"), t.hasField("optionalDependencies"), t.hasField("optionalDependencies") ? t.readValue("optionalDependencies") : null])));
    Assert.isTrue(output.includes("Modules in the build: 2.\nsample runs without tasks, optional for it and left out of the build.\n"), output);
    const sources = await readFile(path.join(app.path, "_build", "generated", "window-parts.ts"), "utf8");
    Assert.isTrue(sources.includes(".then(t => t.windowPart), [], [\"clock\",\"tasks\"])"), sources);
  }

  @TestMethod
  public async refusesAnOptionalDependencyTheBuildIncludesAtAnotherVersion(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeDeclarationAsync({ optionalDependencies: { clock: "0.0.2" } }, ["runtime", "window"]);
    await app.writeTreeModuleAsync("clock", ["runtime"], {});

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`sample optionally depends on clock 0.0.2, but the build includes clock ${ModuleAppFixture.MODULE_VERSION}.\n`), output);
  }

  @TestMethod
  public async refusesACycleThroughAnOptionalDependencyTheBuildIncludes(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeDeclarationAsync({ optionalDependencies: { clock: ModuleAppFixture.MODULE_VERSION } }, ["runtime", "window"]);
    await app.writeTreeModuleAsync("clock", ["runtime"], {}, { sample: ModuleAppFixture.MODULE_VERSION });

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith("The dependencies of sample, clock form a cycle.\n"), output);
  }

  @TestMethod
  public async refusesAModuleNamedAsBothADependencyAndAnOptionalDependency(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    const versions = { clock: ModuleAppFixture.MODULE_VERSION };
    await app.writeDeclarationAsync({ dependencies: versions, optionalDependencies: versions }, ["runtime", "window"]);
    await app.writeTreeModuleAsync("clock", ["runtime"], {});

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleCatalogTests.OPTIONAL_DECLARATION}names clock as both a dependency and an optional dependency.\n`), output);
  }

  @TestMethod
  @TestData("[]", "must list its optional dependencies as an object from each module's id to the one exact version of it that it needs, such as 1.2.3")
  @TestData("{\"sample\":\"0.0.1\"}", "optionally depends on \"sample\", which is not another module's id")
  @TestData("{\"Clock\":\"0.0.1\"}", "optionally depends on \"Clock\", which is not another module's id")
  @TestData("{\"clock\":\"^0.0.1\"}", "names \"^0.0.1\" for clock, which is not one exact version such as 1.2.3; a dependency names no range")
  public async refusesOptionalDependenciesThatAreNotOtherModulesAtOneExactVersion(value: string, problem: string): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeDeclarationAsync({ optionalDependencies: JSON.parse(value) }, ["runtime", "window"]);

    const output = await ModuleCatalogTests.runAsync(app);

    Assert.isTrue(output.endsWith(`${ModuleCatalogTests.OPTIONAL_DECLARATION}${problem}.\n`), output);
  }

  @TestMethod
  public acceptsAPermissionsModuleThatDesktopModulesLists(): Promise<void> {
    return ModuleCatalogTests.permissionsRunAsync({ permissionsModule: "sample", name: String.empty }, ModuleCatalogTests.INVALID_NAME);
  }

  @TestMethod
  public acceptsAnAppWithoutAPermissionsModule(): Promise<void> {
    return ModuleCatalogTests.permissionsRunAsync({ name: String.empty }, ModuleCatalogTests.INVALID_NAME);
  }

  @TestMethod
  public refusesAPermissionsModuleThatDesktopModulesDoesNotList(): Promise<void> {
    return ModuleCatalogTests.permissionsRunAsync(
      { permissionsModule: "notes" },
      "The root package.json's desktop.product.permissionsModule must be the id of a module in desktop.modules, not \"notes\".\n");
  }

  @TestMethod
  public refusesAPermissionsModuleThatIsNotAnId(): Promise<void> {
    return ModuleCatalogTests.permissionsRunAsync(
      { permissionsModule: null },
      "The root package.json's desktop.product.permissionsModule must be the id of a module in desktop.modules, not null.\n");
  }

  @TestMethod
  public async listsAFixturePackageInATestBuild(): Promise<void> {
    const folder = Resources.formatFolderFile(Resources.modulePackageFixturesFolder, "radio");
    const packageName = "@noldova/desktop.fixture.packages.radio";
    await using tree = await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ desktop: { modules: ["tasks"] } }),
      "src/modules/tasks/module.json": ModuleCatalogTests.declare("tasks", []),
      [`${folder}/module.json`]: ModuleCatalogTests.declare("radio", []),
      [`node_modules/${packageName}/module.json`]: ModuleCatalogTests.declare("radio", []),
      [`node_modules/${packageName}/package.json`]: JSON.stringify({ name: packageName, version: ModuleCatalogTests.VERSION })
    });
    const catalog = new ModuleCatalog(tree.path);

    const regular = await catalog.listBuildAsync(false, []);
    const tested = await catalog.listBuildAsync(true, []);

    Assert.areEqual("tasks", regular.map(t => t.id).join(", "));
    Assert.areEqual("tasks:null, radio:@noldova/desktop.fixture.packages.radio", tested.map(t => `${t.id}:${String(t.packageName)}`).join(", "));
    Assert.isTrue(tested.every(t => Object.isNull(t.windowEntry)));
  }

  @TestMethod
  public async refusesADependencyTheBuildIncludesAtAnotherVersion(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ desktop: { modules: ["notes", "tasks"] } }),
      "src/modules/notes/module.json": ModuleCatalogTests.declare("notes", [], { dependencies: { tasks: ModuleCatalogTests.OTHER } }),
      "src/modules/tasks/module.json": ModuleCatalogTests.declare("tasks", [])
    });

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual(`notes depends on tasks ${ModuleCatalogTests.OTHER}, but the build includes tasks ${ModuleCatalogTests.VERSION}.`, error.message);
  }

  @TestMethod
  public async refusesAListedModuleWithoutADeclaration(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ desktop: { modules: ["ghost"] } }),
      "src/modules/ghost/README.md": "# Ghost\n"
    });
    await using packaged = await ModuleCatalogTests.createRadioAsync({}, {});
    await rm(path.join(packaged.path, "node_modules", "@sample", "radio", "module.json"));

    const fromTree = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException);
    const fromPackage = await Assert.throwsAsync(() => new ModuleCatalog(packaged.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual("The build lists the module ghost, but src/modules/ghost has no module.json.", fromTree.message);
    Assert.areEqual("The build lists the module radio, but node_modules/@sample/radio has no module.json at its package's root.", fromPackage.message);
  }

  @TestMethod
  @TestData("not JSON")
  @TestData(String.empty)
  public async refusesARootManifestThatIsMissingOrNotJson(text: string): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync(text === String.empty ? {} : { "package.json": text });

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual(Resources.moduleListRequired, error.message);
  }

  @TestMethod
  @TestData("[\"notes\",\"notes\"]")
  @TestData("[{\"id\":\"notes\",\"package\":\"@sample/notes\"},{\"id\":\"tasks\",\"package\":\"@sample/notes\"}]")
  @TestData("[1]")
  @TestData("[null]")
  @TestData("[[\"notes\"]]")
  @TestData("[{\"id\":\"notes\"}]")
  @TestData("[{\"id\":\"notes\",\"package\":\"@sample/notes\",\"version\":\"0.0.1\"}]")
  @TestData("[{\"id\":1,\"package\":\"@sample/notes\"}]")
  @TestData("[{\"id\":\"notes\",\"package\":1}]")
  @TestData("[{\"id\":\"notes\",\"package\":\"@Sample/Notes\"}]")
  public async refusesAListOfModulesWithAnEntryOfAnotherFormOrOneTwice(modules: string): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "package.json": `{"desktop":{"modules":${modules}}}` });

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual(Resources.moduleListRequired, error.message);
  }

  @TestMethod
  public async refusesANameAModuleContributesAsTwoKinds(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ desktop: { modules: ["notes"] } }),
      "src/modules/notes/module.json": ModuleCatalogTests.declare("notes", [], { contributes: { methods: ["notes.open"], events: ["notes.open", "notes.saved"] } })
    });

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual("Contributed names repeat in the build: "
      + `${Resources.formatNameInFile("notes.open", "src/modules/notes/module.json (methods), src/modules/notes/module.json (events)")}.`, error.message);
  }

  @TestMethod
  public async readsEachModulesFormerNames(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ desktop: { modules: ["notes", "tasks", "clock"] } }),
      "src/modules/notes/module.json": ModuleCatalogTests.declare("notes", [], { contributes: { commands: ["notes.create"], formerNames: { "notes.create": ["notes.add", "tasks.add"] } } }),
      "src/modules/tasks/module.json": ModuleCatalogTests.declare("tasks", [], { contributes: { documents: ["tasks.page"], formerNames: { "tasks.page": ["tasks.sheet"] } } }),
      "src/modules/clock/module.json": ModuleCatalogTests.declare("clock", [], { contributes: { commands: ["clock.start"] } })
    });

    const declarations = await new ModuleCatalog(tree.path).listBuildAsync(false, []);

    Assert.areEqual(JSON.stringify([["clock", []], ["notes", [["notes.create", ["notes.add", "tasks.add"]]]], ["tasks", [["tasks.page", ["tasks.sheet"]]]]]),
      JSON.stringify(declarations.map(t => [t.id, [...t.formerNames]]).sort()));
  }

  @TestMethod
  public async refusesAFormerNameTwoModulesOrTwoNamesOfAModuleClaim(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ desktop: { modules: ["notes", "tasks"] } }),
      "src/modules/notes/module.json": ModuleCatalogTests.declare("notes", [], {
        contributes: { commands: ["notes.create", "notes.open"], formerNames: { "notes.create": ["old.add"], "notes.open": ["old.show"] } }
      }),
      "src/modules/tasks/module.json": ModuleCatalogTests.declare("tasks", [], {
        contributes: { commands: ["tasks.make"], documents: ["tasks.page"], formerNames: { "tasks.make": ["old.add"], "tasks.page": ["old.show"] } }
      })
    });

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual("Former names repeat in the build, and a former name moves to one command or document: "
      + `${Resources.formatNameInFile("old.add", "src/modules/notes/module.json (formerNames), src/modules/tasks/module.json (formerNames)")}; `
      + `${Resources.formatNameInFile("old.show", "src/modules/notes/module.json (formerNames), src/modules/tasks/module.json (formerNames)")}.`, error.message);
  }

  @TestMethod
  public async refusesAFormerNameThatAModuleContributes(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ desktop: { modules: ["notes", "tasks"] } }),
      "src/modules/notes/module.json": ModuleCatalogTests.declare("notes", [], { contributes: { commands: ["notes.create"], formerNames: { "notes.create": ["tasks.make"] } } }),
      "src/modules/tasks/module.json": ModuleCatalogTests.declare("tasks", [], { contributes: { commands: ["tasks.make"] } })
    });

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual(`Former names are names a module contributes in the build: ${Resources.formatNameInFile("tasks.make", "src/modules/notes/module.json (formerNames)")}.`, error.message);
  }

  @TestMethod
  public async letsAModulePlaceItsToolbarsAndGroupsBesideItsDependencysPlaces(): Promise<void> {
    await using tree = await ModuleCatalogTests.createMenusAsync({ notes: ModuleCatalogTests.VERSION });

    const ordered = await new ModuleCatalog(tree.path).listBuildAsync(false, []);

    Assert.areEqual("notes, tasks", ordered.map(t => t.id).join(", "));
    Assert.areEqual("notes.bar, notes.menu", ordered[0]?.menus.places.map(t => t.name).join(", "));
  }

  @TestMethod
  public async refusesAToolbarBesideAPlaceOfAModuleItDoesNotDependOn(): Promise<void> {
    await using tree = await ModuleCatalogTests.createMenusAsync({});

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual("tasks's menus.json puts the toolbar tasks.bar next to notes.bar, which is not a toolbar of its own or of a module it depends on.", error.message);
  }

  @TestMethod
  @TestData("0.0.2", "0.0.2")
  @TestData(String.empty, "no version of it")
  public async refusesAPackagedModuleInstalledAtAnotherVersionThanItsPin(installed: string, holds: string): Promise<void> {
    await using tree = await ModuleCatalogTests.createRadioAsync({}, {});
    const manifest = path.join(tree.path, "node_modules", "@sample", "radio", "package.json");
    if (installed === String.empty)
      await rm(manifest);
    else
      await tree.writeAsync({ "node_modules/@sample/radio/package.json": JSON.stringify({ name: "@sample/radio", version: installed }) });

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual(`The build lists the module radio from @sample/radio ${ModuleCatalogTests.VERSION}, but node_modules holds ${holds}; run npm install.`, error.message);
  }

  @TestMethod
  public async passesOnAFailureToReadAnInstalledManifestOtherThanAMissingFile(): Promise<void> {
    await using tree = await ModuleCatalogTests.createRadioAsync({}, {});
    await rm(path.join(tree.path, "node_modules", "@sample", "radio", "package.json"));
    await tree.writeAsync({ "node_modules/@sample/radio/package.json/index.json": "{}" });

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), Error);

    Assert.isFalse(error instanceof BuildException);
  }

  @TestMethod
  public async walksPackagesThatDependOnEachOtherOnceAndPassesOverOnesNotInstalled(): Promise<void> {
    await using tree = await ModuleCatalogTests.createRadioAsync(
      { "left-pad": "1.0.0", "right-pad": "1.0.0", "absent-pad": "1.0.0" },
      {
        "node_modules/left-pad/package.json": JSON.stringify({ name: "left-pad", version: "1.0.0", dependencies: { "right-pad": "1.0.0" } }),
        "node_modules/right-pad/package.json": JSON.stringify({ name: "right-pad", version: "1.0.0", dependencies: { "left-pad": "1.0.0" } })
      });

    const declarations = await new ModuleCatalog(tree.path).listBuildAsync(false, []);

    Assert.areEqual("radio:@sample/radio", declarations.map(t => `${t.id}:${String(t.packageName)}`).join(", "));
  }

  @TestMethod
  public async refusesANotInstalledDependencyNamedAsAPackageNoldovaDesktopShares(): Promise<void> {
    await using tree = await ModuleCatalogTests.createRadioAsync({ [ModuleCatalogTests.CONTEXT]: "1.0.0" }, {});

    const error = await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual(
      Resources.formatCatalogSecondCopy("radio", "@sample/radio", `node_modules/@sample/radio lists ${ModuleCatalogTests.CONTEXT} among its dependencies`), error.message);
  }

  @TestMethod
  public async passesAWindowPartWhosePackageDoesNotDependOnItsWindowPackage(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, { dependencies: { [ModuleAppFixture.RUNTIME_PACKAGE]: ModuleAppFixture.MODULE_VERSION } });

    const declarations = await new ModuleCatalog(app.path).listBuildAsync(false, []);

    Assert.areEqual("sample", declarations.map(t => t.id).join(", "));
  }

  @TestMethod
  @TestData("\"^0.0.1\"")
  @TestData("\"0.0.2\"")
  @TestData("1")
  public async refusesAWindowPackagePinThatIsNotTheExactInstalledVersion(pin: string): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, {
      dependencies: { [ModuleAppFixture.RUNTIME_PACKAGE]: ModuleAppFixture.MODULE_VERSION, [ModuleAppFixture.WINDOW_PACKAGE]: JSON.parse(pin) }
    });

    const error = await Assert.throwsAsync(() => new ModuleCatalog(app.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual(ModuleCatalogTests.WINDOW_PIN_INVALID, error.message);
  }

  @TestMethod
  public async refusesAWindowPackageThatIsNotInstalled(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.removeAsync(["node_modules", ...ModuleAppFixture.WINDOW_PACKAGE.split("/")]);

    const error = await Assert.throwsAsync(() => new ModuleCatalog(app.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual(ModuleCatalogTests.WINDOW_PIN_INVALID, error.message);
  }

  @TestMethod
  public async refusesAWindowPackageThatIsNotAnAngularPackage(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.WINDOW_PACKAGE, { peerDependencies: { [ModuleAppFixture.WINDOW]: ModuleAppFixture.NEEDED } });

    const error = await Assert.throwsAsync(() => new ModuleCatalog(app.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual(`${ModuleCatalogTests.WINDOW_SUBJECT} must be an Angular package, with @angular/core among its peer dependencies.`, error.message);
  }

  @TestMethod
  public async refusesAWindowPackageWhoseAngularPeerIsNotOptional(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.WINDOW_PACKAGE, { peerDependenciesMeta: { [ModuleAppFixture.WINDOW]: { optional: true } } });

    const error = await Assert.throwsAsync(() => new ModuleCatalog(app.path).listBuildAsync(false, []), BuildException);

    Assert.areEqual(Resources.formatCatalogWindowPeerNotOptional(ModuleCatalogTests.WINDOW_SUBJECT, ModuleAppFixture.ANGULAR_CORE), error.message);
  }

  @TestMethod
  public async checksANoldovaDesktopPeerAgainstTheVersionOfTheAppsOwnSourcePackage(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleCatalogTests.OTHER, ModuleAppFixture.NEEDED);
    await app.writeFileAsync(["src", "noldova.desktop.runtime", "package.json"], "{}");
    await app.writeFileAsync(["src", "noldova.other", "package.json"], "{}");

    const declarations = await new ModuleCatalog(app.path).listBuildAsync(false, []);

    Assert.areEqual("sample", declarations.map(t => t.id).join(", "));
  }

  @TestMethod
  public async checksANoldovaDesktopPeerOfAnAppWithoutASourceFolderAgainstItsInstalledVersion(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.removeAsync(["src"]);

    const declarations = await new ModuleCatalog(app.path).listBuildAsync(false, []);

    Assert.areEqual("sample", declarations.map(t => t.id).join(", "));
  }

  private static async createRadioAsync(dependencies: Readonly<Record<string, string>>, files: Readonly<Record<string, string>>): Promise<SourceTreeFixture> {
    return await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ dependencies: { "@sample/radio": ModuleCatalogTests.VERSION }, desktop: { modules: [{ id: "radio", package: "@sample/radio" }] } }),
      "node_modules/@sample/radio/module.json": ModuleCatalogTests.declare("radio", []),
      "node_modules/@sample/radio/package.json": JSON.stringify({ name: "@sample/radio", version: ModuleCatalogTests.VERSION, dependencies }),
      ...files
    });
  }

  private static async createMenusAsync(dependencies: Readonly<Record<string, string>>): Promise<SourceTreeFixture> {
    const declaration = (id: string, contributes: Readonly<Record<string, readonly string[]>>, needs: Readonly<Record<string, string>>): string =>
      ModuleCatalogTests.declare(id, [], { dependencies: needs, contributes });
    return await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ desktop: { modules: ["notes", "tasks"] } }),
      "src/modules/notes/module.json": declaration("notes", { menus: ["notes.bar", "notes.menu"] }, {}),
      "src/modules/notes/menus.json": JSON.stringify({ places: [{ name: "notes.bar", title: "Notes", shows: "toolbar" }, { name: "notes.menu", title: "Notes" }], groups: [] }),
      "src/modules/tasks/module.json": declaration("tasks", { menus: ["tasks.bar"], commands: ["tasks.add"] }, dependencies),
      "src/modules/tasks/menus.json": JSON.stringify({
        places: [{ name: "tasks.bar", title: "Tasks", shows: "toolbar", after: "notes.bar" }],
        groups: [{ name: "tasks.actions", place: "notes.menu", items: [{ command: "tasks.add", label: "Add" }] }]
      })
    });
  }

  private static async createAsync(): Promise<SourceTreeFixture> {
    return await SourceTreeFixture.createAsync({
      "package.json": JSON.stringify({ desktop: { modules: ["notes", "tasks"] } }),
      "src/modules/notes/module.json": ModuleCatalogTests.declare("notes", ["tasks"]),
      "src/modules/tasks/module.json": ModuleCatalogTests.declare("tasks", []),
      "src/modules/unlisted/module.json": ModuleCatalogTests.declare("unlisted", []),
      [`${Resources.moduleFixtureFolder}/clock/module.json`]: ModuleCatalogTests.declare("clock", ["notes"]),
      [`${Resources.moduleFixtureFolder}/weather/module.json`]: ModuleCatalogTests.declare("weather", [])
    });
  }

  private static declare(id: string, dependencies: readonly string[], fields: Readonly<Record<string, unknown>> = {}): string {
    return JSON.stringify({
      id,
      version: ModuleCatalogTests.VERSION,
      displayName: id,
      description: "Used by the tests.",
      parts: [],
      dependencies: Object.fromEntries(dependencies.map(t => [t, ModuleCatalogTests.VERSION])),
      contributes: {},
      ...fields
    });
  }

  private static async createWithAngularPeerAsync(range: string): Promise<ModuleAppFixture> {
    const app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.WINDOW_PACKAGE, {
      peerDependencies: { [ModuleAppFixture.ANGULAR_CORE]: range, [ModuleAppFixture.WINDOW]: ModuleAppFixture.NEEDED }
    });
    return app;
  }

  private static async createWithOrganizationPeerAsync(needed: string, isWindowPart: boolean): Promise<ModuleAppFixture> {
    const app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeFileAsync(["node_modules", ...ModuleCatalogTests.ORGANIZATION_PEER.split("/"), "package.json"],
      JSON.stringify({ name: ModuleCatalogTests.ORGANIZATION_PEER, version: ModuleCatalogTests.ORGANIZATION_VERSION }));
    await app.editInstalledManifestAsync(isWindowPart ? ModuleAppFixture.WINDOW_PACKAGE : ModuleAppFixture.MODULE_PACKAGE, {
      peerDependencies: {
        ...(isWindowPart
          ? { [ModuleAppFixture.ANGULAR_CORE]: ModuleAppFixture.ANGULAR_VERSION, [ModuleAppFixture.WINDOW]: ModuleAppFixture.NEEDED }
          : { [ModuleAppFixture.RUNTIME]: ModuleAppFixture.NEEDED }),
        [ModuleCatalogTests.ORGANIZATION_PEER]: needed
      }
    });
    return app;
  }

  private static async runAsync(app: ModuleAppFixture, environment: NodeJS.ProcessEnv = {}): Promise<string> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    await new BuildCommandLine(app.path, environment, process.platform, process.arch, output, new PassThrough()).runAsync(["build"]);
    return chunks.join(String.empty);
  }

  private static async createRangedAsync(): Promise<ModuleAppFixture> {
    const app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeDeclarationAsync({ noldovaDesktop: ModuleCatalogTests.RANGE }, ["runtime", "window"]);
    await ModuleCatalogTests.writePeerAsync(app, ModuleAppFixture.MODULE_PACKAGE, ModuleAppFixture.RUNTIME, ModuleCatalogTests.RANGE);
    await ModuleCatalogTests.writePeerAsync(app, ModuleAppFixture.WINDOW_PACKAGE, ModuleAppFixture.WINDOW, ModuleCatalogTests.RANGE);
    return app;
  }

  private static async createKitPeerAsync(range: string, installed: string): Promise<ModuleAppFixture> {
    const app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    const file = path.join(app.path, "node_modules", ...ModuleAppFixture.WINDOW_PACKAGE.split("/"), "package.json");
    const manifest = JsonReader.parse(await readFile(file, "utf8"));
    await app.editInstalledManifestAsync(ModuleAppFixture.WINDOW_PACKAGE, {
      peerDependencies: { ...ModuleCatalogTests.readFields(manifest, "peerDependencies"), [ModuleCatalogTests.KIT]: range },
      peerDependenciesMeta: { ...ModuleCatalogTests.readFields(manifest, "peerDependenciesMeta"), [ModuleCatalogTests.KIT]: { optional: true } }
    });
    if (installed !== String.empty)
      await app.writeFileAsync(["node_modules", ...ModuleCatalogTests.KIT.split("/"), "package.json"], JSON.stringify({ name: ModuleCatalogTests.KIT, version: installed }));
    return app;
  }

  private static async createContextPeerAsync(isOptional: boolean): Promise<ModuleAppFixture> {
    const app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, {
      peerDependencies: { [ModuleAppFixture.RUNTIME]: ModuleAppFixture.NEEDED, [ModuleCatalogTests.CONTEXT]: ">=1.0.0 <2.0.0" },
      peerDependenciesMeta: { [ModuleCatalogTests.CONTEXT]: { optional: isOptional } }
    });
    return app;
  }

  private static async writeRangedTreeModuleAsync(app: ModuleAppFixture, range: string): Promise<void> {
    await app.writeTreeModuleAsync("clock", [], {});
    await app.writeModuleJsonAsync("clock", "module.json", {
      id: "clock",
      version: ModuleAppFixture.MODULE_VERSION,
      displayName: "Tree",
      description: "A module the app builds from its own tree.",
      parts: [],
      dependencies: {},
      contributes: {},
      noldovaDesktop: range
    });
  }

  private static async writePeerAsync(app: ModuleAppFixture, packageName: string, peer: string, version: string): Promise<void> {
    const manifest = JsonReader.parse(await readFile(path.join(app.path, "node_modules", ...packageName.split("/"), "package.json"), "utf8"));
    await app.editInstalledManifestAsync(packageName, { peerDependencies: { ...ModuleCatalogTests.readFields(manifest, "peerDependencies"), [peer]: version } });
  }

  private static readFields(manifest: JsonReader, field: string): JsonObject {
    return manifest.hasField(field) ? manifest.readObject(field).toJson() : {};
  }

  private static async readDeclarationsAsync(app: ModuleAppFixture): Promise<JsonReader> {
    return JsonReader.parse(await readFile(path.join(app.path, "_build", "modules", "declarations.json"), "utf8"));
  }

  private static readModules(document: JsonReader): readonly JsonObject[] {
    return document.readObjectArray("modules").map(t => t.toJson());
  }

  private static async permissionsRunAsync(product: Readonly<Record<string, unknown>>, ending: string): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync(product);
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));

    await new BuildCommandLine(app.path, {}, process.platform, process.arch, output, new PassThrough()).runAsync(["build"]);

    Assert.isTrue(chunks.join(String.empty).endsWith(ending), chunks.join(String.empty));
  }
}
