/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BuildCommandLine } from "@noldova/desktop.build";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { BuildLayout } from "../../../src/services/packages/build-layout.js";
import { ModuleWindowImports } from "../../../src/services/packages/module-window-imports.js";
import { ModuleAppFixture } from "../../fixtures/module-app.fixture.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class ModuleWindowImportsTests {
  private static readonly OTHER_MODULE: string = "@noldova/other";

  @TestMethod
  public async packsAndInstallsNoModulePackageForTheWindow(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();

    const output = await ModuleWindowImportsTests.runAsync(app, environment);

    Assert.isTrue(output.includes("Angular packages built and installed: 0.\n"), output);
    Assert.areEqual(0, (await app.readPackedArchivesAsync()).length);
    Assert.areEqual(0, (await app.readInstalledArchivesAsync()).length);
  }

  @TestMethod
  public async acceptsAWindowEntryThatImportsPackagesItsModuleListsThroughReExportsRelativeFilesAndDynamicImports(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.writeModuleFileAsync("window.js", `export * from "${ModuleAppFixture.WINDOW_PACKAGE}";\nexport * from "./lazy.js";\n`);
    await app.writeModuleFileAsync("lazy.js", `export const loadRuntime = () => import("${ModuleAppFixture.RUNTIME}/api");\n`);

    const output = await ModuleWindowImportsTests.runAsync(app, environment);

    Assert.isTrue(output.includes("Angular packages built and installed: 0.\n"), output);
  }

  @TestMethod
  public async refusesAWindowEntryWhoseRelativeFileImportsAPackageItsModuleDoesNotList(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.writeModuleFileAsync("window.js", `export * from "${ModuleAppFixture.WINDOW_PACKAGE}";\nexport * from "./lazy.js";\n`);
    await app.writeModuleFileAsync("lazy.js", `export const loadFormat = () => import("${ModuleAppFixture.LOCKED_PACKAGE}/reader");\n`);

    const output = await ModuleWindowImportsTests.runAsync(app, environment);

    Assert.isTrue(output.endsWith(`${ModuleAppFixture.MODULE_PACKAGE}'s window part imports ${ModuleAppFixture.LOCKED_PACKAGE}/reader, but ${ModuleAppFixture.MODULE_PACKAGE} `
      + `doesn't list ${ModuleAppFixture.LOCKED_PACKAGE} among its dependencies, optional dependencies or peer dependencies; a window part imports by name only what its module's `
      + "package lists.\n"), output);
    Assert.areEqual(0, (await app.readInstalledArchivesAsync()).length);
  }

  @TestMethod
  public async refusesAWindowEntryThatReachesAnotherModuleOtherThanThroughItsWindowEntry(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.addModulePackageAsync("other", ModuleWindowImportsTests.OTHER_MODULE);
    await app.writeModuleFileAsync("window.js", `export { windowPart } from "${ModuleAppFixture.WINDOW_PACKAGE}";\nexport { runtimePart } from "${ModuleWindowImportsTests.OTHER_MODULE}/runtime";\n`);

    const output = await ModuleWindowImportsTests.runAsync(app, environment);

    Assert.isTrue(output.endsWith(`${ModuleAppFixture.MODULE_PACKAGE}'s window part imports ${ModuleWindowImportsTests.OTHER_MODULE}/runtime, another module's package; `
      + `a window part reaches another module only through its window entry, ${ModuleWindowImportsTests.OTHER_MODULE}/window.\n`), output);
  }

  @TestMethod
  public async acceptsAWindowEntryThatReachesAnotherModuleThroughItsWindowEntry(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.addModulePackageAsync("other", ModuleWindowImportsTests.OTHER_MODULE);
    await app.writeModuleFileAsync("window.js", `export { windowPart } from "${ModuleAppFixture.WINDOW_PACKAGE}";\nexport { otherPart } from "${ModuleWindowImportsTests.OTHER_MODULE}/window";\n`);

    const output = await ModuleWindowImportsTests.runAsync(app, environment);

    Assert.isTrue(output.includes("Angular packages built and installed: 0.\n"), output);
  }

  @TestMethod
  public async refusesAModulePackageWithoutAFileAtItsWindowExport(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.removeAsync(["node_modules", ...ModuleAppFixture.MODULE_PACKAGE.split("/"), "window.js"]);

    const output = await ModuleWindowImportsTests.runAsync(app, environment);

    Assert.isTrue(output.endsWith(`${ModuleAppFixture.MODULE_PACKAGE} has no file at its ./window export; the build reads the window part's entry there to check the packages `
      + "it imports.\n"), output);
    Assert.areEqual(0, (await app.readInstalledArchivesAsync()).length);
  }

  @TestMethod
  public async refusesAModulePackageWhoseWindowExportHasNoImportOrDefaultCondition(): Promise<void> {
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    const environment = await app.writeNpmAsync();
    await app.editInstalledManifestAsync(ModuleAppFixture.MODULE_PACKAGE, { exports: { "./runtime": "./runtime.js", "./window": { require: "./window.js" } } });

    const output = await ModuleWindowImportsTests.runAsync(app, environment);

    Assert.isTrue(output.endsWith(`${ModuleAppFixture.MODULE_PACKAGE} has no file at its ./window export; the build reads the window part's entry there to check the packages `
      + "it imports.\n"), output);
  }

  @TestMethod
  public async refusesAModulePackageWhoseExportsAreNoMapOfPaths(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      [`node_modules/${ModuleAppFixture.MODULE_PACKAGE}/package.json`]: JSON.stringify({ name: ModuleAppFixture.MODULE_PACKAGE, exports: "./window.js" }),
      [`node_modules/${ModuleAppFixture.MODULE_PACKAGE}/window.js`]: "export const windowPart = 1;\n"
    });

    const error = await Assert.throwsAsync(() => new ModuleWindowImports(new BuildLayout(tree.path)).checkAsync([ModuleAppFixture.MODULE_PACKAGE]), BuildException);

    Assert.areEqual(`${ModuleAppFixture.MODULE_PACKAGE} has no file at its ./window export; the build reads the window part's entry there to check the packages it imports.`, error.message);
  }

  @TestMethod
  public async namesAnUnscopedPackageByTheFirstSegmentOfWhatTheWindowEntryImports(): Promise<void> {
    const name = ModuleAppFixture.MODULE_PACKAGE;
    const manifest = { name, exports: { "./window": "./window.js" } };
    await using tree = await SourceTreeFixture.createAsync({
      [`node_modules/${name}/package.json`]: JSON.stringify(manifest),
      [`node_modules/${name}/window.js`]: `export { reader } from "${ModuleAppFixture.THIRD_PARTY}/reader";\n`
    });
    const imports = new ModuleWindowImports(new BuildLayout(tree.path));

    const error = await Assert.throwsAsync(() => imports.checkAsync([name]), BuildException);
    await tree.writeAsync({ [`node_modules/${name}/package.json`]: JSON.stringify({ ...manifest, dependencies: { [ModuleAppFixture.THIRD_PARTY]: ModuleAppFixture.THIRD_PARTY_VERSION } }) });
    await imports.checkAsync([name]);

    Assert.areEqual(`${name}'s window part imports ${ModuleAppFixture.THIRD_PARTY}/reader, but ${name} doesn't list ${ModuleAppFixture.THIRD_PARTY} among its dependencies, `
      + "optional dependencies or peer dependencies; a window part imports by name only what its module's package lists.", error.message);
  }

  private static async runAsync(app: ModuleAppFixture, environment: NodeJS.ProcessEnv): Promise<string> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    await new BuildCommandLine(app.path, environment, process.platform, process.arch, output, new PassThrough()).runAsync(["build"]);
    return chunks.join(String.empty);
  }
}
