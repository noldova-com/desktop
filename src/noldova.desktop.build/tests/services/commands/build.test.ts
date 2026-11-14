/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ModuleDeclaration } from "../../../src/models/modules/module-declaration.js";
import { Resources } from "../../../src/resources.js";
import { BuildStepsFixture } from "../../fixtures/build-steps.fixture.js";

@TestClass
export class BuildTests {
  private static readonly FEED: string = "http://127.0.0.1:47325/";

  @TestMethod
  public async buildsEveryStepInOrderAndNamesAbsentOptionalModulesAsync(): Promise<void> {
    await using root = await BuildTests.createRootAsync();
    const declarations = [await ModuleDeclaration.readAsync(root.path, "src/modules/clock", false), await ModuleDeclaration.readAsync(root.path, "src/modules/notes", false)];
    const steps = new BuildStepsFixture();

    const result = await BuildTests.runAsync(steps, root.path, [], declarations, [BuildStepsFixture.createPackage("one"), BuildStepsFixture.createPackage("two")]);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual(["prepare", "packages false  false null", "angular-packages", "modules false ", "product null", "desktop-version", "artifacts 2 null 1.2.3",
      "product-file", "gallery false", "install-angular clock,notes", "electron", "window null"].join("|"), steps.steps.join("|"));
    Assert.areEqual("Packages built and installed: 2.\nModules in the build: 2.\nnotes runs without tasks, optional for it and left out of the build.\n", result.output);
  }

  @TestMethod
  public async buildsATestVariantWithoutModulesIntoAnOutputFolderForAFeedAsync(): Promise<void> {
    const steps = new BuildStepsFixture();
    const output = path.resolve("out");

    const result = await BuildTests.runAsync(steps, tmpdir(), ["--test", "--without", "clock", "--output", "out", "--update-feed", BuildTests.FEED, "--without", "tasks"]);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual(Resources.buildNoPackages, result.output.split("Modules in the build")[0]);
    Assert.areEqual(["prepare", `packages true clock,tasks false ${BuildTests.FEED}`, "angular-packages", "modules true clock,tasks", `product ${output}`, "desktop-version",
      `artifacts 0 ${output} 1.2.3`, "product-file", "gallery false", "install-angular ", "electron", `window ${path.join(output, "window")}`].join("|"), steps.steps.join("|"));
  }

  @TestMethod
  public async checksAPackagedBuildCarriesNoGalleryAsync(): Promise<void> {
    const steps = new BuildStepsFixture();

    const result = await BuildTests.runAsync(steps, tmpdir(), ["--packaged"]);

    Assert.areEqual(0, result.exitCode, result.output);
    Assert.areEqual("gallery true", steps.steps[8]);
    Assert.areEqual(`window null|verify null ${Resources.galleryMarkers.length}`, steps.steps.slice(-2).join("|"));
  }

  @TestMethod
  public async listsTheInstalledCopiesAsync(): Promise<void> {
    const steps = new BuildStepsFixture();

    const result = await BuildTests.runAsync(steps, tmpdir(), ["--list-copies"]);

    Assert.areEqual(0, result.exitCode);
    Assert.areEqual("sample-app\tnode_modules/@noldova/desktop.cli\t1.2.3\nend of copies\n", result.output);
    Assert.areEqual("copies", steps.steps.join());
  }

  @TestMethod
  public async answersArgumentsItCannotUseWithItsUsageAsync(): Promise<void> {
    const cases: readonly (readonly string[])[] = [
      ["--list-copies", "--test"],
      ["--output"],
      ["--output", "out"],
      ["--test", "--quick", "now"],
      ["--packaged", "--without", "clock"],
      ["--test", "--output", "a", "--output", "b"],
      ["--test", "--output", "a", "--update-feed", BuildTests.FEED, "--update-feed", BuildTests.FEED],
      ["--test", "--output", "a", "--update-feed", "ftp://127.0.0.1/"],
      ["--packaged", "--update-feed", BuildTests.FEED]
    ];

    for (const buildArguments of cases) {
      const steps = new BuildStepsFixture();

      const result = await BuildTests.runAsync(steps, tmpdir(), buildArguments);

      Assert.areEqual(2, result.exitCode, buildArguments.join(" "));
      Assert.areEqual(Resources.buildUsage, result.output, buildArguments.join(" "));
      Assert.areEqual(0, steps.steps.length, buildArguments.join(" "));
    }
  }

  @TestMethod
  public async reportsAFailureOfAPackageAProgramOrAModuleAsync(): Promise<void> {
    const failures = [new BuildException("A package failed."), new BuildException("tsc failed."), new BuildException("A module is invalid.")];

    for (const failure of failures) {
      const result = await BuildTests.runAsync(new BuildStepsFixture("modules", failure), tmpdir(), []);

      Assert.areEqual(1, result.exitCode);
      Assert.isTrue(result.output.endsWith(`${failure.message}\n`), result.output);
    }
  }

  @TestMethod
  public async throwsAFailureThatIsNotTheBuildsOwnAsync(): Promise<void> {
    const failure = new Error("out of memory");

    const error = await Assert.throwsAsync(() => BuildTests.runAsync(new BuildStepsFixture("electron", failure), tmpdir(), []), Error);

    Assert.areEqual(failure, error);
  }

  private static async runAsync(steps: BuildStepsFixture, root: string, buildArguments: readonly string[], declarations: readonly ModuleDeclaration[] = [],
    packages: readonly ReturnType<typeof BuildStepsFixture.createPackage>[] = []): Promise<{ readonly exitCode: number; readonly output: string }> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (t: Buffer) => chunks.push(t.toString()));
    const exitCode = await steps.create(root, declarations, packages, output).runAsync(buildArguments);
    return { exitCode, output: chunks.join(String.empty) };
  }

  private static async createRootAsync(): Promise<{ readonly path: string } & AsyncDisposable> {
    const root = await mkdtemp(path.join(tmpdir(), "desktop-build-command-"));
    await writeFile(path.join(root, "package.json"), JSON.stringify({ version: "1.0.0" }));
    for (const [id, optional] of [["clock", {}], ["notes", { clock: "1.0.0", tasks: "1.0.0" }]] as const) {
      const folder = path.join(root, "src", "modules", id);
      await mkdir(path.join(folder, "runtime"), { recursive: true });
      await writeFile(path.join(folder, "module.json"), JSON.stringify({
        id, version: "1.0.0", displayName: id, description: `The ${id} module.`, parts: ["runtime"], dependencies: {}, optionalDependencies: optional, contributes: {}
      }));
    }
    return {
      path: root,
      [Symbol.asyncDispose]: async (): Promise<void> => {
        await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
      }
    };
  }
}
