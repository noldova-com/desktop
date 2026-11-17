/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { RootManifest } from "../../../src/models/packages/root-manifest.js";
import { CompanyPackage } from "../../../src/models/packaging/company-package.js";
import { LockedPackage } from "../../../src/models/packaging/locked-package.js";
import { PackageTarget } from "../../../src/models/packaging/package-target.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { PackageStage } from "../../../src/services/packaging/package-stage.js";
import { ThirdPartyClosure } from "../../../src/services/packaging/third-party-closure.js";
import { ProcessRunner } from "../../../src/services/processes/process-runner.js";
import { NpmCommand } from "../../../src/services/toolchain/npm-command.js";
import { ModuleAppFixture } from "../../fixtures/module-app.fixture.js";
import { type ITarballEntry, TarballFixture } from "../../fixtures/tarball.fixture.js";
import { TemporaryFolderRunnerFixture } from "../../fixtures/temporary-folder-runner.fixture.js";

class PackRunner extends ProcessRunner {
  private readonly exitCode: number;

  public readonly calls: string[] = [];

  public constructor(exitCode: number) {
    super();
    this.exitCode = exitCode;
  }

  public override captureAsync(...call: Parameters<ProcessRunner["captureAsync"]>): Promise<ProcessResult> {
    this.calls.push(call[1].join(" "));
    return Promise.resolve(new ProcessResult(this.exitCode, String.empty, this.exitCode === 0 ? String.empty : "npm refused"));
  }
}

@TestClass
export class CompanyPackageTests {
  private static readonly MODULE: string = `${ModuleAppFixture.MODULE_PACKAGE}@${ModuleAppFixture.MODULE_VERSION}`;
  private static readonly MODULE_MANIFEST: string = JSON.stringify({ name: ModuleAppFixture.MODULE_PACKAGE, version: ModuleAppFixture.MODULE_VERSION });
  private static readonly NO_MANIFEST: string = ` holds no package.json for ${CompanyPackageTests.MODULE}, so it cannot ship.\n`;
  private static readonly WINDOWS_PATH: string = "a path that Windows reads as another file or refuses, so it cannot ship.\n";

  @TestMethod
  public async refusesAModuleArchiveEntryThatIsNeitherAFileNorAFolder(): Promise<void> {
    const symbolic = await CompanyPackageTests.packageModuleAsync([{ name: "package/index.js", type: "2" }]);
    const hard = await CompanyPackageTests.packageModuleAsync([{ name: "package/index.js", type: "1" }]);
    const device = await CompanyPackageTests.packageModuleAsync([{ name: "package/index.js", type: "3" }]);

    CompanyPackageTests.assertRefusal(" holds index.js as a symbolic link, and packaging takes only files and folders, so it cannot ship.\n", symbolic);
    CompanyPackageTests.assertRefusal(" holds index.js as a hard link, and packaging takes only files and folders, so it cannot ship.\n", hard);
    CompanyPackageTests.assertRefusal(" holds index.js as a tar entry of type 3, and packaging takes only files and folders, so it cannot ship.\n", device);
  }

  @TestMethod
  public async refusesAModuleArchiveFileAboveItsFolder(): Promise<void> {
    const result = await CompanyPackageTests.packageModuleAsync([{ name: "package/../outside.js", text: String.empty }]);

    CompanyPackageTests.assertOutside("../outside.js", result);
  }

  @TestMethod
  public async refusesAModuleArchiveFileWithAnAbsolutePath(): Promise<void> {
    const root = await CompanyPackageTests.packageModuleAsync([{ name: "/outside.js", text: String.empty }]);
    const nested = await CompanyPackageTests.packageModuleAsync([{ name: "package//outside.js", text: String.empty }]);

    CompanyPackageTests.assertOutside("/outside.js", root);
    CompanyPackageTests.assertOutside("/outside.js", nested);
  }

  @TestMethod
  public async refusesAModuleArchiveFileWithAnEmptySegment(): Promise<void> {
    const result = await CompanyPackageTests.packageModuleAsync([{ name: "package/assets//index.js", text: String.empty }]);

    CompanyPackageTests.assertOutside("assets//index.js", result);
  }

  @TestMethod
  public async refusesAModuleArchiveFileWithADotSegment(): Promise<void> {
    const result = await CompanyPackageTests.packageModuleAsync([{ name: "package/./index.js", text: String.empty }]);

    CompanyPackageTests.assertOutside("./index.js", result);
  }

  @TestMethod
  public async refusesAModuleArchivePaxPathAboveItsFolder(): Promise<void> {
    const relative = `${"nested-folder/".repeat(7)}${"../".repeat(8)}outside.js`;

    const result = await CompanyPackageTests.packageModuleAsync([{ name: `${TarballFixture.FOLDER}${relative}`, text: String.empty }]);

    CompanyPackageTests.assertOutside(relative, result);
  }

  @TestMethod
  public async refusesAModuleArchiveFileWithABackslashOrColon(): Promise<void> {
    const backslash = await CompanyPackageTests.packageModuleAsync([{ name: "package/assets\\index.js", text: String.empty }]);
    const colon = await CompanyPackageTests.packageModuleAsync([{ name: "package/c:index.js", text: String.empty }]);

    CompanyPackageTests.assertRefusal(` holds assets\\index.js, ${CompanyPackageTests.WINDOWS_PATH}`, backslash);
    CompanyPackageTests.assertRefusal(` holds c:index.js, ${CompanyPackageTests.WINDOWS_PATH}`, colon);
  }

  @TestMethod
  public async refusesAModuleArchivePathThatWindowsReadsAsAnotherFile(): Promise<void> {
    for (const name of ["con.js", "assets/LPT1", "index.js.", "index.js ", "a<b.js", "a>b.js", "a\"b.js", "a|b.js", "a?b.js", "a*b.js", "a\u0001b.js", "a\u001fb.js",
      "CONIN$", "assets/conout$.txt", "COM¹.js", "com²", "LPT³.txt", "COM0.js", "assets/lpt0"]) {
      const result = await CompanyPackageTests.packageModuleAsync([{ name: `${TarballFixture.FOLDER}${name}`, text: String.empty }]);

      CompanyPackageTests.assertRefusal(` holds ${name}, ${CompanyPackageTests.WINDOWS_PATH}`, result);
    }
  }

  @TestMethod
  public async refusesModuleArchiveFilesThatDifferOnlyInCase(): Promise<void> {
    const result = await CompanyPackageTests.packageModuleAsync([{ name: "package/Index.js", text: String.empty }, { name: "package/index.js", text: String.empty }]);

    CompanyPackageTests.assertSameName("Index.js", "index.js", result);
  }

  @TestMethod
  public async refusesModuleArchiveFoldersThatDifferOnlyInCase(): Promise<void> {
    const result = await CompanyPackageTests.packageModuleAsync([{ name: "package/Assets/one.js", text: String.empty }, { name: "package/assets/two.js", text: String.empty }]);

    CompanyPackageTests.assertSameName("Assets", "assets", result);
  }

  @TestMethod
  public async refusesModuleArchiveNamesThatDifferOnlyInUnicodeForm(): Promise<void> {
    const composed = "café";
    const decomposed = "café";

    const files = await CompanyPackageTests.packageModuleAsync([{ name: `package/${composed}.js`, text: String.empty }, { name: `package/${decomposed}.js`, text: String.empty }]);
    const folders = await CompanyPackageTests.packageModuleAsync([{ name: `package/${decomposed}/one.js`, text: String.empty }, { name: `package/${composed.toUpperCase()}/two.js`, text: String.empty }]);

    CompanyPackageTests.assertSameName(`${composed}.js`, `${decomposed}.js`, files);
    CompanyPackageTests.assertSameName(decomposed, composed.toUpperCase(), folders);
  }

  @TestMethod
  public async refusesModuleArchiveNamesThatFoldToOneAnother(): Promise<void> {
    const dotless = await CompanyPackageTests.packageModuleAsync([{ name: "package/index.js", text: String.empty }, { name: "package/ındex.js", text: String.empty }]);
    const longS = await CompanyPackageTests.packageModuleAsync([{ name: "package/style.js", text: String.empty }, { name: "package/ſtyle.js", text: String.empty }]);

    CompanyPackageTests.assertSameName("index.js", "ındex.js", dotless);
    CompanyPackageTests.assertSameName("style.js", "ſtyle.js", longS);
  }

  @TestMethod
  public async refusesAModuleArchiveWithoutItsPackageJson(): Promise<void> {
    const result = await CompanyPackageTests.packageModuleAsync([], null);

    CompanyPackageTests.assertRefusal(CompanyPackageTests.NO_MANIFEST, result);
  }

  @TestMethod
  public async refusesAModuleArchiveWhosePackageJsonIsNotJson(): Promise<void> {
    const result = await CompanyPackageTests.packageModuleAsync([], "{");

    CompanyPackageTests.assertRefusal(CompanyPackageTests.NO_MANIFEST, result);
  }

  @TestMethod
  public async refusesAModuleArchiveWhosePackageJsonNamesAnotherPackageOrVersion(): Promise<void> {
    const name = await CompanyPackageTests.packageModuleAsync([], JSON.stringify({ name: "@noldova/other", version: ModuleAppFixture.MODULE_VERSION }));
    const version = await CompanyPackageTests.packageModuleAsync([], JSON.stringify({ name: ModuleAppFixture.MODULE_PACKAGE, version: "0.0.2" }));

    CompanyPackageTests.assertRefusal(CompanyPackageTests.NO_MANIFEST, name);
    CompanyPackageTests.assertRefusal(CompanyPackageTests.NO_MANIFEST, version);
  }

  @TestMethod
  public async packsARegistryPackageFromWhereItIsInstalled(): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync({ name: "sample", version: "1.0.0" });
    const runner = new PackRunner(0);
    const folder = path.join(root.path, "packed");

    const packed = await CompanyPackage.packAsync(CompanyPackageTests.lockRegistry(), root.path, folder, new NpmCommand(runner, { npm_execpath: "npm-cli.js" }), new Set());

    Assert.areEqual(path.join(folder, "sample-1.0.0.tgz"), packed.file);
    Assert.areEqual(`npm-cli.js pack --ignore-scripts --loglevel=error --pack-destination ${folder} ${path.join(root.path, "node_modules", "sample")}`, runner.calls.join("|"));
  }

  @TestMethod
  public async refusesAnInstalledPackageThatCannotBeReadOrIsAnother(): Promise<void> {
    await using missing = await CompanyPackageTests.createRootAsync(null);
    await using other = await CompanyPackageTests.createRootAsync({ name: "sample", version: "2.0.0" });
    const pack = (root: string): Promise<CompanyPackage> => CompanyPackage.packAsync(CompanyPackageTests.lockRegistry(), root, path.join(root, "packed"),
      new NpmCommand(new PackRunner(0), { npm_execpath: "npm-cli.js" }), new Set());

    const unreadable = await Assert.throwsAsync(() => pack(missing.path), BuildException);
    const mismatch = await Assert.throwsAsync(() => pack(other.path), BuildException);

    Assert.areEqual("sample@1.0.0 could not be read at node_modules/sample, where npm ci installs it after checking it against package-lock.json; "
      + "the stage takes the company's packages only from there.", unreadable.message);
    Assert.areEqual("node_modules/sample does not hold sample@1.0.0, which package-lock.json locks; run npm ci, so the stage takes the locked package.", mismatch.message);
  }

  @TestMethod
  public async refusesAFailedPack(): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync({ name: "sample", version: "1.0.0" });

    const error = await Assert.throwsAsync(() => CompanyPackage.packAsync(CompanyPackageTests.lockRegistry(), root.path, path.join(root.path, "packed"),
      new NpmCommand(new PackRunner(1), { npm_execpath: "npm-cli.js" }), new Set()), BuildException);

    Assert.areEqual("Packing sample@1.0.0 from node_modules/sample failed with exit code 1:\nnpm refused", error.message);
  }

  @TestMethod
  public async packsACopyWithoutItsWindowPackagesOrNodeModules(): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync({ name: "sample", version: "1.0.0", dependencies: { "@sample/window": "1.0.0", "kept": "1.0.0" } });
    await mkdir(path.join(root.path, "node_modules", "sample", "node_modules", "kept"), { recursive: true });
    const runner = new PackRunner(0);
    const folder = path.join(root.path, "packed");
    const source = path.join(folder, "sources", "sample");

    await CompanyPackage.packAsync(CompanyPackageTests.lockRegistry(), root.path, folder, new NpmCommand(runner, { npm_execpath: "npm-cli.js" }), new Set(["@sample/window"]));

    Assert.areEqual(`npm-cli.js pack --ignore-scripts --loglevel=error --pack-destination ${folder} ${source}`, runner.calls.join("|"));
    Assert.areEqual("{\"name\":\"sample\",\"version\":\"1.0.0\",\"dependencies\":{\"kept\":\"1.0.0\"}}", JSON.stringify(JsonReader.parse(await readFile(path.join(source, "package.json"), "utf8")).toJson()));
    Assert.isFalse(existsSync(path.join(source, "node_modules")));
  }

  @TestMethod
  public async takesTheArchiveAnInstalledPackageCameFromWhenItBundlesNoWindowPackage(): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync({ name: "sample", version: "1.0.0" });
    const archive = TarballFixture.create({ "package.json": JSON.stringify({ name: "sample", version: "1.0.0" }) });
    await writeFile(path.join(root.path, "sample-1.0.0.tgz"), archive);
    const runner = new PackRunner(0);

    const packed = await CompanyPackage.packAsync(CompanyPackageTests.lockInstalled(archive), root.path, path.join(root.path, "packed"),
      new NpmCommand(runner, { npm_execpath: "npm-cli.js" }), new Set());

    Assert.areEqual(path.join(root.path, "sample-1.0.0.tgz"), packed.file);
    Assert.areEqual(0, runner.calls.length);
  }

  @TestMethod
  public async extractsTheArchiveOfAnInstalledPackageThatBundlesAWindowPackage(): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync({ name: "sample", version: "1.0.0", dependencies: { "@sample/window": "1.0.0" } });
    const archive = TarballFixture.createEntries([
      { name: "package/", type: "5" }, { name: "package/lib/", type: "5" }, { name: "package/lib/index.js", text: "module.exports = 1;\n" },
      { name: "package/package.json", text: JSON.stringify({ name: "sample", version: "1.0.0" }) }
    ]);
    await writeFile(path.join(root.path, "sample-1.0.0.tgz"), archive);
    const folder = path.join(root.path, "packed");
    const source = path.join(folder, "sources", "sample");

    await CompanyPackage.packAsync(CompanyPackageTests.lockInstalled(archive), root.path, folder, new NpmCommand(new PackRunner(0), { npm_execpath: "npm-cli.js" }),
      new Set(["@sample/window"]));

    Assert.areEqual("module.exports = 1;\n", await readFile(path.join(source, "lib", "index.js"), "utf8"));
    Assert.areEqual("{\"name\":\"sample\",\"version\":\"1.0.0\",\"dependencies\":{}}", JSON.stringify(JsonReader.parse(await readFile(path.join(source, "package.json"), "utf8")).toJson()));
  }

  @TestMethod
  public async refusesAnInstalledPackageWhoseArchiveIsGoneOrChanged(): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync({ name: "sample", version: "1.0.0" });
    const archive = TarballFixture.create({ "package.json": JSON.stringify({ name: "sample", version: "1.0.0" }) });
    const file = path.join(root.path, "sample-1.0.0.tgz");
    const pack = (): Promise<CompanyPackage> => CompanyPackage.packAsync(CompanyPackageTests.lockInstalled(archive), root.path, path.join(root.path, "packed"),
      new NpmCommand(new PackRunner(0), { npm_execpath: "npm-cli.js" }), new Set());

    const gone = await Assert.throwsAsync(pack, BuildException);
    await writeFile(file, "changed");
    const changed = await Assert.throwsAsync(pack, BuildException);

    Assert.areEqual(`sample@1.0.0 was installed from ${file}, which can no longer be read; build the app's packages and install the app again.`, gone.message);
    Assert.areEqual(`${file} no longer matches the integrity npm recorded when it installed sample@1.0.0; build the app's packages and install the app again.`, changed.message);
  }

  @TestMethod
  public async shipsTheArchiveALockedNoldovaPackageIsLockedToInThePackagesFolderOnceItMatches(): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync({ name: "@noldova/sample", version: "1.0.0" }, "@noldova/sample");
    const archive = TarballFixture.create({ "package.json": JSON.stringify({ name: "@noldova/sample", version: "1.0.0" }) });
    const file = path.join(root.path, "_packages", "noldova-sample-1.0.0.tgz");
    const runner = new PackRunner(0);
    const pack = (): Promise<CompanyPackage> => CompanyPackage.packAsync(new LockedPackage("node_modules/@noldova/sample", { version: "1.0.0",
      resolved: "file:_packages/noldova-sample-1.0.0.tgz", integrity: `sha512-${createHash("sha512").update(archive).digest("base64")}` }), root.path,
      path.join(root.path, "packed"), new NpmCommand(runner, { npm_execpath: "npm-cli.js" }), new Set());

    const gone = await Assert.throwsAsync(pack, BuildException);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, "changed");
    const changed = await Assert.throwsAsync(pack, BuildException);
    await writeFile(file, archive);
    const packed = await pack();

    Assert.areEqual(`@noldova/sample@1.0.0 was installed from ${file}, which can no longer be read; build the app's packages and install the app again.`, gone.message);
    Assert.areEqual(`${file} no longer matches the integrity npm recorded when it installed @noldova/sample@1.0.0; build the app's packages and install the app again.`,
      changed.message);
    Assert.areEqual(file, packed.file);
    Assert.areEqual(0, runner.calls.length);
  }

  @TestMethod
  public async shipsTheArchiveALockedNoldovaComPackageIsLockedTo(): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync({ name: "@noldova-com/sample", version: "1.0.0" }, "@noldova-com/sample");
    const archive = TarballFixture.create({ "package.json": JSON.stringify({ name: "@noldova-com/sample", version: "1.0.0" }) });
    const file = path.join(root.path, "_packages", "noldova-com-sample-1.0.0.tgz");
    await mkdir(path.dirname(file));
    await writeFile(file, archive);

    const packed = await CompanyPackage.packAsync(CompanyPackageTests.lockArchive("@noldova-com/sample", "file:_packages/noldova-com-sample-1.0.0.tgz", archive), root.path,
      path.join(root.path, "packed"), new NpmCommand(new PackRunner(1), { npm_execpath: "npm-cli.js" }), new Set());

    Assert.areEqual(file, packed.file);
  }

  @TestMethod
  public async refusesALockedArchiveAboveTheRepositoryOrAboveAnAppInNoRepository(): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync(null);
    const archive = TarballFixture.create({ "package.json": JSON.stringify({ name: "@noldova/sample", version: "1.0.0" }) });
    const file = path.join(root.path, "_packages", "noldova-sample-1.0.0.tgz");
    const repository = path.join(root.path, "repository");
    const other = path.join(root.path, "other", "app");
    await mkdir(path.dirname(file));
    await writeFile(file, archive);
    await mkdir(path.join(repository, ".git"), { recursive: true });
    await mkdir(path.join(repository, "app"));
    await mkdir(other, { recursive: true });
    const pack = (resolved: string, app: string): Promise<BuildException> => Assert.throwsAsync(() => CompanyPackage.packAsync(
      CompanyPackageTests.lockArchive("@noldova/sample", resolved, archive), app, path.join(root.path, "packed"),
      new NpmCommand(new PackRunner(1), { npm_execpath: "npm-cli.js" }), new Set()), BuildException);

    const aboveRepository = await pack("file:../../_packages/noldova-sample-1.0.0.tgz", path.join(repository, "app"));
    const aboveApp = await pack("file:../../_packages/noldova-sample-1.0.0.tgz", other);

    Assert.areEqual(`@noldova/sample@1.0.0 is locked to ${file}, which is outside the repository at ${repository}; `
      + "an app ships only the archives in its own repository's _packages folders.", aboveRepository.message);
    Assert.areEqual(`@noldova/sample@1.0.0 is locked to ${file}, which is outside the repository at ${other}; `
      + "an app ships only the archives in its own repository's _packages folders.", aboveApp.message);
  }

  @TestMethod
  public async refusesALockedArchiveALinkLeadsToOutsideOrInsideTheRepository(): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync(null);
    const archive = TarballFixture.create({ "package.json": JSON.stringify({ name: "@noldova/sample", version: "1.0.0" }) });
    const messages: string[] = [];
    const expected: string[] = [];
    const cases: readonly (readonly [string, string])[] = [
      [path.join(root.path, "first"), path.join(root.path, "outside")],
      [path.join(root.path, "second"), path.join(root.path, "second", "stored")]
    ];
    for (const [repository, target] of cases) {
      const file = path.join(repository, "_packages", "noldova-sample-1.0.0.tgz");
      await mkdir(path.join(repository, ".git"), { recursive: true });
      await mkdir(target);
      await writeFile(path.join(target, "noldova-sample-1.0.0.tgz"), archive);
      await symlink(target, path.join(repository, "_packages"), "junction");

      const error = await Assert.throwsAsync(() => CompanyPackage.packAsync(CompanyPackageTests.lockArchive("@noldova/sample", "file:_packages/noldova-sample-1.0.0.tgz", archive),
        repository, path.join(root.path, "packed"), new NpmCommand(new PackRunner(1), { npm_execpath: "npm-cli.js" }), new Set()), BuildException);

      messages.push(error.message);
      expected.push(`@noldova/sample@1.0.0 is locked to ${file}, which a link leads to ${path.join(await realpath(target), "noldova-sample-1.0.0.tgz")}; `
        + "an app ships an archive only from its repository's own _packages folder, not through a link.");
    }

    Assert.areEqual(expected.join(" | "), messages.join(" | "));
  }

  @TestMethod
  public async shipsAndLoadsTheArchiveNpmLocksFromThePackagesFolderOfTheApp(): Promise<void> {
    await CompanyPackageTests.installPackAndLoadAsync([]);
  }

  @TestMethod
  public async shipsAndLoadsTheArchiveNpmLocksFromThePackagesFolderOfTheRepositoryAboveTheApp(): Promise<void> {
    await CompanyPackageTests.installPackAndLoadAsync(["app"]);
  }

  @TestMethod
  public async refusesAPackageNpmLocksToAnArchiveOutsideThePackagesFolder(): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync(null);
    await mkdir(path.join(root.path, ".git"));
    await mkdir(path.join(root.path, "vendor"));
    await writeFile(path.join(root.path, "vendor", "noldova-sample-1.0.0.tgz"), CompanyPackageTests.createLoadableArchive());
    await CompanyPackageTests.npmInstallAsync(root.path, root.path, "file:vendor/noldova-sample-1.0.0.tgz");
    const closure = await ThirdPartyClosure.readAsync(root.path, PackageTarget.fromProcess("linux", "x64"));

    const error = Assert.throws(() => closure.collect([], ["@noldova/sample"]), BuildException);

    Assert.areEqual("@noldova/sample@1.0.0 at node_modules/@noldova/sample in package-lock.json is locked to file:vendor/noldova-sample-1.0.0.tgz; "
      + "a locked file ships only as a .tgz archive of a Noldova package directly in the _packages folder of the app's folder or of a folder above it.", error.message);
  }

  private static async installPackAndLoadAsync(appFolder: readonly string[]): Promise<void> {
    await using root = await CompanyPackageTests.createRootAsync(null);
    const archive = CompanyPackageTests.createLoadableArchive();
    const file = path.join(root.path, "_packages", "noldova-sample-1.0.0.tgz");
    const app = path.join(root.path, ...appFolder);
    await mkdir(path.join(root.path, ".git"));
    await mkdir(path.dirname(file));
    await mkdir(app, { recursive: true });
    await writeFile(file, archive);
    const resolved = `file:${"../".repeat(appFolder.length)}_packages/noldova-sample-1.0.0.tgz`;
    const npm = await CompanyPackageTests.npmInstallAsync(root.path, app, resolved);
    const [[locked]] = (await ThirdPartyClosure.readAsync(app, PackageTarget.fromProcess("linux", "x64"))).collect([], ["@noldova/sample"]);
    if (Object.isUndefined(locked))
      throw new Error("npm locked no @noldova/sample.");

    const packed = await CompanyPackage.packAsync(locked, app, path.join(root.path, "packed"), npm, new Set());
    const shipped = await readFile(packed.file);
    const stage = path.join(root.path, "stage");
    await mkdir(stage);
    await PackageStage.installAsync(npm, stage, new RootManifest("1.0.0", 1), { name: "sample-stage", version: "1.0.0", private: true }, path.join(root.path, "stage-cache"),
      new Map([["@noldova/sample", packed.file]]));
    await writeFile(file, "rebuilt archive");
    const changed = await Assert.throwsAsync(() => CompanyPackage.packAsync(locked, app, path.join(root.path, "packed"), npm, new Set()), BuildException);

    Assert.areEqual(`${resolved},${file},true`, [locked.resolved, packed.file, String(archive.equals(shipped))].join());
    const loaded: unknown = createRequire(path.join(stage, "package.json"))("@noldova/sample");
    Assert.areEqual("sample loaded", String(loaded));
    Assert.areEqual(`${file} no longer matches the integrity npm recorded when it installed @noldova/sample@1.0.0; build the app's packages and install the app again.`,
      changed.message);
  }

  private static async npmInstallAsync(root: string, app: string, resolved: string): Promise<NpmCommand> {
    await writeFile(path.join(app, "package.json"), JSON.stringify({ name: "sample-app", version: "1.0.0", private: true, dependencies: { "@noldova/sample": resolved } }));
    const npm = new NpmCommand(await TemporaryFolderRunnerFixture.createAsync(path.join(root, "temporary")), process.env);
    const result = await npm.runAsync(["install", "--ignore-scripts", "--no-audit", "--no-fund", "--loglevel=error", "--cache", path.join(root, "cache")], app);
    Assert.isTrue(result.isSuccessful, result.text);
    return npm;
  }

  private static createLoadableArchive(): Buffer {
    return TarballFixture.create({
      "package.json": JSON.stringify({ name: "@noldova/sample", version: "1.0.0", main: "index.js" }),
      "index.js": "module.exports = 'sample loaded';"
    });
  }

  private static lockArchive(name: string, resolved: string, archive: Buffer): LockedPackage {
    return new LockedPackage(`node_modules/${name}`, { version: "1.0.0", resolved, integrity: `sha512-${createHash("sha512").update(archive).digest("base64")}` });
  }

  private static lockRegistry(): LockedPackage {
    return new LockedPackage("node_modules/sample", { version: "1.0.0", resolved: "https://registry.example.com/sample-1.0.0.tgz", integrity: "sha512-AAAA" });
  }

  private static lockInstalled(archive: Buffer): LockedPackage {
    return new LockedPackage("node_modules/sample", { version: "1.0.0", resolved: "file:sample-1.0.0.tgz",
      integrity: `sha512-${createHash("sha512").update(archive).digest("base64")}` }, true);
  }

  private static async createRootAsync(manifest: object | null, name: string = "sample"): Promise<{ path: string } & AsyncDisposable> {
    const root = await mkdtemp(path.join(tmpdir(), "company-package-"));
    const installed = path.join(root, "node_modules", ...name.split("/"));
    if (!Object.isNull(manifest)) {
      await mkdir(installed, { recursive: true });
      await writeFile(path.join(installed, "package.json"), JSON.stringify(manifest));
    }
    return { path: root, [Symbol.asyncDispose]: () => rm(root, { recursive: true, force: true }) };
  }

  private static async packageModuleAsync(entries: readonly ITarballEntry[], manifest: string | null = CompanyPackageTests.MODULE_MANIFEST): Promise<string> {
    const { FOLDER } = TarballFixture;
    await using app = await ModuleAppFixture.createAsync(ModuleAppFixture.NEEDED, ModuleAppFixture.NEEDED);
    await app.writeProductAsync();
    await app.installForPackagingAsync(TarballFixture.createEntries([
      { name: FOLDER, type: "5" },
      ...(Object.isNull(manifest) ? [] : [{ name: `${FOLDER}package.json`, text: manifest }]),
      ...entries
    ]));
    return await app.packageAsync(await app.writeNpmAsync());
  }

  private static assertOutside(name: string, result: string): void {
    CompanyPackageTests.assertRefusal(` holds ${name}, which would be written outside ${CompanyPackageTests.MODULE}'s folder, so it cannot ship.\n`, result);
  }

  private static assertSameName(first: string, second: string, result: string): void {
    CompanyPackageTests.assertRefusal(` holds ${first} and ${second}, which differ only in case or Unicode form and are one name on Windows or macOS, so they cannot ship.\n`, result);
  }

  private static assertRefusal(ending: string, result: string): void {
    Assert.isTrue(result.startsWith("1 ") && result.endsWith(ending), result);
  }
}
