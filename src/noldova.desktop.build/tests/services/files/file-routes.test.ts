/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ModuleDeclaration } from "../../../src/models/modules/module-declaration.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { Resources } from "../../../src/resources.js";
import { DevelopmentBinary } from "../../../src/services/desktop/development-binary.js";
import { ElectronBinary } from "../../../src/services/desktop/electron-binary.js";
import { ByteFile } from "../../../src/services/files/byte-file.js";
import { TextFile } from "../../../src/services/files/text-file.js";
import { ModuleCatalog } from "../../../src/services/modules/module-catalog.js";
import { ModuleCliCommands } from "../../../src/services/modules/module-cli-commands.js";
import { ModuleMenus } from "../../../src/services/modules/module-menus.js";
import { ModuleSettings } from "../../../src/services/modules/module-settings.js";
import { ModuleWebViews } from "../../../src/services/modules/module-web-views.js";
import { BuildLayout } from "../../../src/services/packages/build-layout.js";
import { ContentHash } from "../../../src/services/packages/content-hash.js";
import { ImportClosure } from "../../../src/services/packages/import-closure.js";
import { ModuleWindowImports } from "../../../src/services/packages/module-window-imports.js";
import { StagedSources } from "../../../src/services/packaging/staged-sources.js";
import { UnpackedFiles } from "../../../src/services/packaging/unpacked-files.js";
import { DevelopmentFolderFixture } from "../../fixtures/development-folder.fixture.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class FileRoutesTests {
  private static readonly BROKEN: string = "{";
  private static readonly MODULE: string = "node_modules/@sample/module";

  @TestMethod
  public async readsAModulesDeclarationThroughTextFile(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ [`${FileRoutesTests.MODULE}/module.json`]: FileRoutesTests.BROKEN });

    const read = await FileRoutesTests.recordAsync(async () => {
      await Assert.throwsAsync(() => ModuleDeclaration.readAsync(tree.path, FileRoutesTests.MODULE, false), BuildException);
    });

    FileRoutesTests.assertRead(read.texts, `${FileRoutesTests.MODULE}/module.json`);
  }

  @TestMethod
  public async readsAFixtureModulesDeclarationThroughTextFile(): Promise<void> {
    const file = `${Resources.moduleFixtureFolder}/clock/module.json`;
    await using tree = await SourceTreeFixture.createAsync({ "package.json": JSON.stringify({ desktop: { modules: [] } }), [file]: FileRoutesTests.BROKEN });

    const read = await FileRoutesTests.recordAsync(async () => {
      await Assert.throwsAsync(() => new ModuleCatalog(tree.path).listBuildAsync(true, []), BuildException);
    });

    FileRoutesTests.assertRead(read.texts, file);
  }

  @TestMethod
  public async readsAModulesCommandLineFileThroughTextFile(): Promise<void> {
    await FileRoutesTests.assertBrokenReadAsync(Resources.cliFileName, root => ModuleCliCommands.readAsync(root, FileRoutesTests.MODULE, new Map()));
  }

  @TestMethod
  public async readsAModulesMenusFileThroughTextFile(): Promise<void> {
    await FileRoutesTests.assertBrokenReadAsync(Resources.menusFileName, root => ModuleMenus.readAsync(root, FileRoutesTests.MODULE, "module", [], []));
  }

  @TestMethod
  public async readsAModulesSettingsFileThroughTextFile(): Promise<void> {
    await FileRoutesTests.assertBrokenReadAsync(Resources.settingsFileName, root => ModuleSettings.readAsync(root, FileRoutesTests.MODULE, [], new Map()));
  }

  @TestMethod
  public async readsAModulesWebViewsFileThroughTextFile(): Promise<void> {
    await FileRoutesTests.assertBrokenReadAsync(Resources.webViewsFileName, root => ModuleWebViews.readAsync(root, FileRoutesTests.MODULE));
  }

  @TestMethod
  public async readsEachSourceAnImportClosureFollowsThroughTextFile(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "main.js": "import \"./other.js\";\n", "other.js": "export {};\n" });

    const read = await FileRoutesTests.recordAsync(async () => {
      await new ImportClosure(tree.path).listAsync(path.join(tree.path, "main.js"));
    });

    FileRoutesTests.assertRead(read.texts, "main.js", "other.js");
  }

  @TestMethod
  public async readsAModuleWindowPartsSourcesThroughTextFile(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({
      [`${FileRoutesTests.MODULE}/package.json`]: JSON.stringify({ name: "@sample/module", version: "1.0.0", exports: { "./window": "./window.js" } }),
      [`${FileRoutesTests.MODULE}/window.js`]: "export {};\n"
    });

    const read = await FileRoutesTests.recordAsync(async () => {
      await new ModuleWindowImports(new BuildLayout(tree.path)).checkAsync(["@sample/module"]);
    });

    Assert.areEqual(2, read.texts.filter(t => t.endsWith(`${FileRoutesTests.MODULE}/window.js`)).length, read.texts.join());
  }

  @TestMethod
  public async readsAStagedPackagesManifestAndLicenseThroughTextFile(): Promise<void> {
    const source = { url: "https://example.com/sources/sample-1.0.0.tar.gz", size: 10, sha256: "ab".repeat(32) };
    await using tree = await SourceTreeFixture.createAsync({
      [`${FileRoutesTests.MODULE}/package.json`]: JSON.stringify({ name: "@sample/module", version: "1.0.0", noldovaDesktop: { sourcePages: ["https://example.com"], sources: [source] } }),
      [`${FileRoutesTests.MODULE}/LICENSE`]: "License text\n"
    });

    const read = await FileRoutesTests.recordAsync(async () => {
      await StagedSources.listAsync(tree.path);
    });

    FileRoutesTests.assertRead(read.texts, `${FileRoutesTests.MODULE}/package.json`, `${FileRoutesTests.MODULE}/LICENSE`);
  }

  @TestMethod
  public async readsAStagedPackagesManifestForItsUnpackedFilesThroughTextFile(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ [`${FileRoutesTests.MODULE}/package.json`]: JSON.stringify({ name: "@sample/module", version: "1.0.0" }) });

    const read = await FileRoutesTests.recordAsync(async () => {
      await UnpackedFiles.listAsync(tree.path, new PackageTarget(Resources.linuxTarget, "x64"));
    });

    FileRoutesTests.assertRead(read.texts, `${FileRoutesTests.MODULE}/package.json`);
  }

  @TestMethod
  public async readsElectronsPathFileThroughTextFile(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "node_modules/electron/path.txt": "electron" });

    const read = await FileRoutesTests.recordAsync(async () => {
      Assert.isFalse(await new ElectronBinary(tree.path, new ScriptedRunnerFixture()).isInstalledAsync());
    });

    FileRoutesTests.assertRead(read.texts, "node_modules/electron/path.txt");
  }

  @TestMethod
  public async hashesAFileThroughByteFile(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "node_modules/sample/index.js": "export {};\n" });

    const read = await FileRoutesTests.recordAsync(async () => {
      await ContentHash.ofTreeAsync(path.join(tree.path, "node_modules", "sample"));
    });

    FileRoutesTests.assertRead(read.bytes, "node_modules/sample/index.js");
  }

  @TestMethod
  public async hashesTheBuildsOwnCodeForTheDevelopmentStampThroughByteFile(): Promise<void> {
    await using folder = await DevelopmentFolderFixture.createAsync();
    await folder.writeLinuxDistributionAsync();
    const binary = new DevelopmentBinary(folder.path, new ScriptedRunnerFixture(), "linux", "x64");

    const read = await FileRoutesTests.recordAsync(async () => {
      await binary.prepareAsync(new PassThrough());
    });

    Assert.isTrue(read.bytes.some(t => path.basename(t).startsWith("development-binary.")), read.bytes.join());
  }

  private static async assertBrokenReadAsync(fileName: string, run: (root: string) => Promise<unknown>): Promise<void> {
    const file = `${FileRoutesTests.MODULE}/${fileName}`;
    await using tree = await SourceTreeFixture.createAsync({ [file]: FileRoutesTests.BROKEN });

    const read = await FileRoutesTests.recordAsync(async () => {
      await Assert.throwsAsync(() => run(tree.path), BuildException);
    });

    FileRoutesTests.assertRead(read.texts, file);
  }

  private static assertRead(read: readonly string[], ...files: readonly string[]): void {
    for (const file of files)
      Assert.isTrue(read.some(t => t.endsWith(`/${file}`)), `${file} not in ${read.join()}`);
  }

  private static async recordAsync(run: () => Promise<void>): Promise<{ readonly texts: readonly string[]; readonly bytes: readonly string[] }> {
    const readText = TextFile.readAsync.bind(TextFile);
    const readBytes = ByteFile.readAsync.bind(ByteFile);
    const texts: string[] = [];
    const bytes: string[] = [];
    TextFile.readAsync = (file: string): Promise<string> => {
      texts.push(file.split(path.sep).join(path.posix.sep));
      return readText(file);
    };
    ByteFile.readAsync = (file: string): Promise<Buffer> => {
      bytes.push(file.split(path.sep).join(path.posix.sep));
      return readBytes(file);
    };
    try {
      await run();
    }
    finally {
      TextFile.readAsync = readText;
      ByteFile.readAsync = readBytes;
    }
    return { texts, bytes };
  }
}
