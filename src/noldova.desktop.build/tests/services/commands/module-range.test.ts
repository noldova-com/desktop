/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ModuleRange } from "../../../src/services/commands/module-range.js";

@TestClass
export class ModuleRangeTests {
  private static readonly PUBLISHED: string = JSON.stringify(["0.0.69", "0.0.70", "0.0.72", "0.0.71", "0.1.0", "0.1.3", "1.0.0", "1.4.2", "1.10.0", "2.0.0", "0.0.73-beta.1"]);
  private static readonly MODULE_FILE: string = path.join("src", "notes", "module.json");
  private static readonly NOT_PIN: string = "the range's lowest version is the module's exact development pin, as MODULES.md's \"Noldova Desktop versions\" says.";

  @TestMethod
  public async writesTheRangeAndTheNewestPublishedVersionInsideItAsync(): Promise<void> {
    for (const [range, newest, count] of [[">=0.0.70 <0.1.0", "0.0.72", 3], [">=0.1.0 <0.2.0", "0.1.3", 2], [">=1.0.0 <2.0.0", "1.10.0", 3]] as const) {
      const result = await ModuleRangeTests.runAsync({ noldovaDesktop: range }, {}, ModuleRangeTests.pinning(range.slice(2, range.indexOf(" "))));

      Assert.areEqual(0, result.exitCode, range);
      Assert.areEqual(`The range ${range} holds ${String(count)} published Noldova Desktop versions; the newest is ${newest}.\n`, result.output, range);
      Assert.areEqual(`signed=yes\nrange=${range}\nversion=${newest}\n`, result.written, range);
    }
  }

  @TestMethod
  public async takesTheOneVersionNpmGivesAsAStringAsync(): Promise<void> {
    const result = await ModuleRangeTests.runAsync({ noldovaDesktop: ">=0.0.71 <0.1.0" }, { PUBLISHED_VERSIONS: "\"0.0.71\"" }, ModuleRangeTests.pinning("0.0.71"));

    Assert.areEqual(0, result.exitCode);
    Assert.areEqual("signed=yes\nrange=>=0.0.71 <0.1.0\nversion=0.0.71\n", result.written);
  }

  @TestMethod
  public async takesTheExactNoldovaDesktopPinsOfTheRootManifestAndPassesOverItsOtherDependenciesAsync(): Promise<void> {
    const manifest = {
      dependencies: { "@noldova/desktop.runtime": "0.0.70", "@noldova/context.core": "^1.2.3", "@noldova/ui.components.angular": 70 },
      devDependencies: { "@noldova/desktop.build": "0.0.70", "@noldova/desktop.window": "0.0.70" }
    };

    const result = await ModuleRangeTests.runAsync({ noldovaDesktop: ">=0.0.70 <0.1.0" }, {}, manifest);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual("signed=yes\nrange=>=0.0.70 <0.1.0\nversion=0.0.72\n", result.written);
  }

  @TestMethod
  public async refusesARangeWhoseLowestVersionIsNotTheRootManifestsPinAsync(): Promise<void> {
    const file = ModuleRangeTests.MODULE_FILE;
    for (const [manifest, message] of [
      [{ dependencies: { "@noldova/desktop.window": "0.0.71" } }, `${file}'s noldovaDesktop is >=0.0.70 <0.1.0, but the root package.json pins @noldova/desktop.window at 0.0.71; ${ModuleRangeTests.NOT_PIN}`],
      [{ devDependencies: { "@noldova/desktop.runtime": "0.0.70", "@noldova/desktop.window": "0.0.69" } },
        `${file}'s noldovaDesktop is >=0.0.70 <0.1.0, but the root package.json pins @noldova/desktop.window at 0.0.69; ${ModuleRangeTests.NOT_PIN}`]
    ] as const) {
      const result = await ModuleRangeTests.runAsync({ noldovaDesktop: ">=0.0.70 <0.1.0" }, {}, manifest);

      Assert.areEqual(1, result.exitCode, message);
      Assert.areEqual(`::error::${message}\n`, result.output, message);
      Assert.areEqual("signed=yes\n", result.written);
    }
  }

  @TestMethod
  public async refusesANoldovaDesktopDependencyAtAnythingButOneExactVersionBesideAnExactPinAsync(): Promise<void> {
    const pins = " not at one exact version; a module pins each Noldova Desktop package to the exact version its range starts at, as MODULES.md's \"Noldova Desktop versions\" says.";
    for (const [manifest, message] of [
      [{ dependencies: { "@noldova/desktop.runtime": "0.0.70" }, devDependencies: { "@noldova/desktop.build": "^0.0.71" } }, `The root package.json names @noldova/desktop.build at "^0.0.71",${pins}`],
      [{ dependencies: { "@noldova/desktop.runtime": "0.0.70", "@noldova/desktop.window": 70 } }, `The root package.json names @noldova/desktop.window at 70,${pins}`]
    ] as const) {
      const result = await ModuleRangeTests.runAsync({ noldovaDesktop: ">=0.0.70 <0.1.0" }, {}, manifest);

      Assert.areEqual(1, result.exitCode, message);
      Assert.areEqual(`::error::${message}\n`, result.output, message);
      Assert.areEqual("signed=yes\n", result.written);
    }
  }

  @TestMethod
  public async refusesARootManifestThatCannotBeReadOrPinsNoNoldovaDesktopVersionAsync(): Promise<void> {
    const unreadable = "The root package.json could not be read as JSON.";
    const unpinned = "The root package.json pins no Noldova Desktop package to one exact version, the version a module builds and tests against.";
    for (const [manifest, message] of [
      [null, unreadable],
      ["{", unreadable],
      [["@noldova/desktop.runtime"], unreadable],
      [{ dependencies: "@noldova/desktop.runtime" }, unpinned],
      [{ devDependencies: { "@noldova/context.core": "0.0.70", "@noldova/ui.components.angular": "1.0.0" } }, unpinned]
    ] as const) {
      const result = await ModuleRangeTests.runAsync({ noldovaDesktop: ">=0.0.70 <0.1.0" }, {}, manifest);

      Assert.areEqual(1, result.exitCode, JSON.stringify(manifest));
      Assert.areEqual(`::error::${message}\n`, result.output, JSON.stringify(manifest));
      Assert.areEqual("signed=yes\n", result.written);
    }
  }

  @TestMethod
  public async refusesAModuleWithNoRangeOrAnUnreadableDeclarationAsync(): Promise<void> {
    const file = ModuleRangeTests.MODULE_FILE;
    for (const [declaration, message] of [
      [{ id: "notes" }, `${file} names no noldovaDesktop range, so there is no range to check; a module names one as MODULES.md's "Noldova Desktop versions" says.`],
      [{ noldovaDesktop: 71 }, `${file} names no noldovaDesktop range, so there is no range to check; a module names one as MODULES.md's "Noldova Desktop versions" says.`],
      [["notes"], `${file} could not be read as a JSON object.`],
      ["{", `${file} could not be read as a JSON object.`],
      [null, `${file} could not be read as a JSON object.`]
    ] as const) {
      const result = await ModuleRangeTests.runAsync(declaration);

      Assert.areEqual(1, result.exitCode, message);
      Assert.areEqual(`::error::${message}\n`, result.output, JSON.stringify(declaration));
      Assert.areEqual("signed=yes\n", result.written);
    }
  }

  @TestMethod
  public async throwsADeclarationFailureThatIsNeitherJsonNorAMissingFileAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-module-range-"));
    try {
      await mkdir(path.join(folder, ModuleRangeTests.MODULE_FILE), { recursive: true });
      const command = new ModuleRange(folder, { PUBLISHED_VERSIONS: ModuleRangeTests.PUBLISHED, GITHUB_OUTPUT: path.join(folder, "output") }, new PassThrough(), "noldova-desktop-release");

      const error = await Assert.throwsAsync(() => command.runAsync(["src/notes"]), Error);

      Assert.isTrue(error.message.startsWith("EISDIR"), error.message);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  @TestMethod
  public async refusesARangeOfAnotherFormOrOneThatDoesNotEndAtTheNextBreakingVersionAsync(): Promise<void> {
    const file = ModuleRangeTests.MODULE_FILE;
    for (const [range, message] of [
      ["^0.0.71", `${file}'s noldovaDesktop is "^0.0.71", not of the one form >=<lowest version> <first version refused>, such as >=0.0.70 <0.1.0.`],
      [">=0.0.71 <0.2.0", `${file}'s noldovaDesktop is >=0.0.71 <0.2.0, but a range from 0.0.71 ends below the next version that may break modules: >=0.0.71 <0.1.0.`],
      [">=0.0.71 <0.0.80", `${file}'s noldovaDesktop is >=0.0.71 <0.0.80, but a range from 0.0.71 ends below the next version that may break modules: >=0.0.71 <0.1.0.`],
      [">=1.2.0 <1.3.0", `${file}'s noldovaDesktop is >=1.2.0 <1.3.0, but a range from 1.2.0 ends below the next version that may break modules: >=1.2.0 <2.0.0.`]
    ] as const) {
      const result = await ModuleRangeTests.runAsync({ noldovaDesktop: range });

      Assert.areEqual(1, result.exitCode, range);
      Assert.areEqual(`::error::${message}\n`, result.output, range);
    }
  }

  @TestMethod
  public async refusesPublishedVersionsItCannotReadOrThatHoldNoneInsideTheRangeAsync(): Promise<void> {
    for (const [published, message] of [
      [String.empty, "PUBLISHED_VERSIONS holds no list of versions as npm view's JSON gives it."],
      ["[\"0.0.71\", 72]", "PUBLISHED_VERSIONS holds no list of versions as npm view's JSON gives it."],
      ["[\"0.0.69\", \"0.1.0\"]", `No published Noldova Desktop version is inside ${ModuleRangeTests.MODULE_FILE}'s noldovaDesktop range >=0.0.70 <0.1.0.`]
    ] as const) {
      const result = await ModuleRangeTests.runAsync({ noldovaDesktop: ">=0.0.70 <0.1.0" }, { PUBLISHED_VERSIONS: published });

      Assert.areEqual(1, result.exitCode, published);
      Assert.areEqual(`::error::${message}\n`, result.output, published);
    }
  }

  @TestMethod
  public async readsNoPublishedVersionsWhenTheVariableIsUnsetAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-module-range-"));
    try {
      await mkdir(path.join(folder, "src", "notes"), { recursive: true });
      await writeFile(path.join(folder, ModuleRangeTests.MODULE_FILE), JSON.stringify({ noldovaDesktop: ">=0.0.70 <0.1.0" }));
      await writeFile(path.join(folder, "package.json"), JSON.stringify(ModuleRangeTests.pinning("0.0.70")));
      const output = new PassThrough();

      const exitCode = await new ModuleRange(folder, { GITHUB_OUTPUT: path.join(folder, "output") }, output, "noldova-desktop-release").runAsync(["src/notes"]);

      Assert.areEqual(1, exitCode);
      Assert.areEqual("::error::PUBLISHED_VERSIONS holds no list of versions as npm view's JSON gives it.\n", output.read(output.readableLength)?.toString() ?? String.empty);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  @TestMethod
  public async refusesToChooseWithoutAStepOutputFileAsync(): Promise<void> {
    for (const environment of [{ PUBLISHED_VERSIONS: ModuleRangeTests.PUBLISHED }, { PUBLISHED_VERSIONS: ModuleRangeTests.PUBLISHED, GITHUB_OUTPUT: String.empty }]) {
      const output = new PassThrough();

      const exitCode = await new ModuleRange(tmpdir(), environment, output, "noldova-desktop-release").runAsync(["src/notes"]);

      Assert.areEqual(1, exitCode);
      Assert.areEqual("::error::GITHUB_OUTPUT names no file for the step's range and version outputs.\n", output.read(output.readableLength)?.toString() ?? String.empty);
    }
  }

  @TestMethod
  public async answersNoFolderOrMoreThanOneWithItsUsageAsync(): Promise<void> {
    for (const commandArguments of [[], ["src/notes", "src/tasks"]]) {
      const output = new PassThrough();

      const exitCode = await new ModuleRange(tmpdir(), {}, output, "noldova-desktop-release").runAsync(commandArguments);

      Assert.areEqual(2, exitCode);
      Assert.areEqual("Usage: PUBLISHED_VERSIONS=<the versions npm view lists, as JSON> noldova-desktop-release module-range <module folder>\n", output.read(output.readableLength)?.toString() ?? String.empty);
    }
  }

  private static pinning(version: string): unknown {
    return { devDependencies: { "@noldova/desktop.runtime": version } };
  }

  private static async runAsync(
    declaration: unknown, environment: Readonly<Record<string, string>> = {}, manifest: unknown = ModuleRangeTests.pinning("0.0.70")
  ): Promise<{ readonly exitCode: number; readonly output: string; readonly written: string }> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-module-range-"));
    try {
      await mkdir(path.join(folder, "src", "notes"), { recursive: true });
      if (!Object.isNull(declaration))
        await writeFile(path.join(folder, ModuleRangeTests.MODULE_FILE), Object.isString(declaration) ? declaration : JSON.stringify(declaration));
      if (!Object.isNull(manifest))
        await writeFile(path.join(folder, "package.json"), Object.isString(manifest) ? manifest : JSON.stringify(manifest));
      const file = path.join(folder, "output");
      await writeFile(file, "signed=yes\n");
      const output = new PassThrough();
      const exitCode = await new ModuleRange(folder, { PUBLISHED_VERSIONS: ModuleRangeTests.PUBLISHED, ...environment, GITHUB_OUTPUT: file }, output, "noldova-desktop-release")
        .runAsync(["src/notes"]);
      return { exitCode, output: output.read(output.readableLength)?.toString() ?? String.empty, written: await readFile(file, "utf8") };
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }
}
