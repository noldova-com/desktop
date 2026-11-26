/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, symlink } from "node:fs/promises";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { BuildCommandLine } from "@noldova/desktop.build";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
import { Resources } from "../../../src/resources.js";
import { AngularProject } from "../../../src/services/angular/angular-project.js";
import { NpmCommand } from "../../../src/services/toolchain/npm-command.js";
import { AppFolderFixture } from "../../fixtures/app-folder.fixture.js";
import { PausedTimersFixture } from "../../fixtures/paused-timers.fixture.js";
import { ScriptedRunnerFixture } from "../../fixtures/scripted-runner.fixture.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class AngularProjectTests {
  private static readonly WINDOW: string = "@noldova/desktop.window";
  private static readonly PROTOCOL: string = "@noldova/desktop.protocol";
  private static readonly EARLIER_FIXTURE: string = "@noldova/desktop.fixture.clock.window";
  private static readonly RUNTIME: string = "@noldova/desktop.runtime";
  private static readonly NOT_INSTALLED: string = "The app isn't installed for its package-lock.json; run noldova-desktop-build install first, "
    + "with the token for the registry its packages come from.\n";
  private static readonly NPM: string = "npm.mjs";
  private static readonly WORKSPACE: string = "src/app.window.app/angular.json";
  private static readonly CLI: string = "node_modules/@angular/cli/bin/ng.js";
  private static readonly RECORD: string = "node_modules/.noldova-install";
  private static readonly LOCKFILE: string = "package-lock.json";
  private static readonly INSTALLED: string = "node_modules/.package-lock.json";
  private static readonly BUILD_ONLY: string = JSON.stringify({ projects: { app: { architect: { build: {} } } } });
  private static readonly WITH_TEST: string = JSON.stringify({ projects: { app: { architect: { build: {}, test: {} } } } });
  private static readonly CI: string = " ci --ignore-scripts --no-audit --no-fund";
  private static readonly BROWSER: string = " install --only-shell chromium";
  private static readonly SECRET: string = "secret-value";
  private static readonly PAUSE: number = 15_000;

  @TestMethod
  public async keepsTheNoldovaDesktopPackagesTheWindowProjectLocksAndRemovesTheOthers(): Promise<void> {
    await using app = await AppFolderFixture.createAsync(false, [AngularProjectTests.WINDOW, AngularProjectTests.PROTOCOL],
      [AngularProjectTests.WINDOW, AngularProjectTests.PROTOCOL, AngularProjectTests.EARLIER_FIXTURE]);

    await AngularProjectTests.runAsync(app, "build");

    Assert.areEqual("true true false", [AngularProjectTests.WINDOW, AngularProjectTests.PROTOCOL, AngularProjectTests.EARLIER_FIXTURE].map(t => app.isInstalled(t)).join(" "));
  }

  @TestMethod
  public async installsNoBrowserWithoutATestTarget(): Promise<void> {
    await using app = await AppFolderFixture.createAsync(false, [], []);

    const output = await AngularProjectTests.runAsync(app, "install");

    Assert.isFalse(app.hasInstalledBrowser);
    Assert.isTrue(output.includes("No test target in an angular.json of a folder in src/, so no browser for the Angular tests.\n"), output);
  }

  @TestMethod
  public async installsNoBrowserForThePackageTestsBuildPart(): Promise<void> {
    await using app = await AppFolderFixture.createAsync(true, [], []);

    const output = await AngularProjectTests.runAsync(app, "install", "--shard=2/2");

    Assert.isFalse(app.hasInstalledBrowser, output);
    Assert.isFalse(output.includes("browser"), output);
  }

  @TestMethod
  public async installsTheBrowserForATestTarget(): Promise<void> {
    await using app = await AppFolderFixture.createAsync(true, [], []);

    const output = await AngularProjectTests.runAsync(app, "install");

    Assert.isTrue(app.hasInstalledBrowser, output);
  }

  @TestMethod
  public async refusesToBuildAWindowProjectThatIsNotInstalledForItsLockfile(): Promise<void> {
    await using app = await AppFolderFixture.createAsync(false, [AngularProjectTests.WINDOW], [AngularProjectTests.WINDOW, AngularProjectTests.EARLIER_FIXTURE]);
    await app.changeLockfileAsync();

    const output = await AngularProjectTests.runAsync(app, "build");

    Assert.isTrue(output.endsWith(AngularProjectTests.NOT_INSTALLED), output);
    Assert.isTrue(app.isInstalled(AngularProjectTests.EARLIER_FIXTURE));
  }

  @TestMethod
  public async refusesToBuildAWindowProjectThatWasNeverInstalled(): Promise<void> {
    await using app = await AppFolderFixture.createAsync(false, [], [AngularProjectTests.EARLIER_FIXTURE]);
    await app.uninstallAsync();

    const output = await AngularProjectTests.runAsync(app, "build");

    Assert.isTrue(output.endsWith(AngularProjectTests.NOT_INSTALLED), output);
    Assert.isTrue(app.isInstalled(AngularProjectTests.EARLIER_FIXTURE));
  }

  @TestMethod
  public async failsTheInstallWhenTwoCopiesOfTheOverlayLibraryAreInstalledAndNamesEach(): Promise<void> {
    await using app = await AppFolderFixture.createAsync(false, [], []);
    await app.listCopiesAsync({
      dependencies: {
        "@angular/cdk": { version: "22.2.1", path: "/app/node_modules/@angular/cdk" },
        "@noldova/ui.components.angular": {
          version: "0.0.56",
          dependencies: { "@angular/cdk": { version: "22.2.0", path: "/app/node_modules/@noldova/ui.components.angular/node_modules/@angular/cdk" } }
        }
      }
    });

    const output = await AngularProjectTests.runAsync(app, "install");

    Assert.areEqual("More than one copy of @angular/cdk is installed in the app, so the kit and Noldova Desktop would each run their own overlay container and focus handling: "
      + "22.2.1 (@angular/cdk); 22.2.0 (@noldova/ui.components.angular > @angular/cdk).\n", output.slice(output.indexOf("More than one")));
  }

  @TestMethod
  public async passesTheInstallWhenOneCopyOfTheOverlayLibraryIsListedUnderSeveralPackages(): Promise<void> {
    await using app = await AppFolderFixture.createAsync(false, [], []);
    await app.listCopiesAsync({
      dependencies: {
        "@angular/cdk": { version: "22.2.1", path: "/app/node_modules/@angular/cdk" },
        "@noldova/ui.components.angular": { version: "0.0.56", dependencies: { "@angular/cdk": { version: "22.2.1", path: "/app/node_modules/@angular/cdk" } } }
      }
    });

    const output = await AngularProjectTests.runAsync(app, "install");

    Assert.isFalse(output.includes("More than one"), output);
  }

  @TestMethod
  public async keepsTheOwnPackagesThatAreNotAngularPackagesWhileItRemovesTheOthers(): Promise<void> {
    await using app = await AppFolderFixture.createAsync(false, [AngularProjectTests.WINDOW],
      [AngularProjectTests.WINDOW, AngularProjectTests.EARLIER_FIXTURE], [AngularProjectTests.RUNTIME]);

    await AngularProjectTests.runAsync(app, "build");

    Assert.areEqual("true false", [AngularProjectTests.RUNTIME, AngularProjectTests.EARLIER_FIXTURE].map(t => app.isInstalled(t)).join(" "));
  }

  @TestMethod
  public async refusesAnAppWithTwoWindowApps(): Promise<void> {
    await using app = await AppFolderFixture.createAsync(false, [], []);
    await app.addWindowAppAsync("second.window.app");

    const output = await AngularProjectTests.runAsync(app, "install");

    Assert.isTrue(output.includes("src/ holds more than one window app, a folder whose name ends in .window.app: app.window.app, second.window.app; an app has one."), output);
  }

  @TestMethod
  public async findsNoWindowAppInAnAngularProjectAtTheRootOfSource(): Promise<void> {
    await using app = await AppFolderFixture.createAsync(false, [], []);
    await app.moveProjectToSourceAsync();

    const output = await AngularProjectTests.runAsync(app, "install");

    Assert.isTrue(output.includes("No window app in src/, a folder whose name ends in .window.app and holds an angular.json; there is nothing to prepare."), output);
    Assert.isFalse(app.hasInstalledBrowser);
  }

  @TestMethod
  public async installsAnAppWithoutAnInstallRecordAndRecordsTheLockfileItInstalled(): Promise<void> {
    const lockfile = "{\"lockfileVersion\":3}";
    await using tree = await AngularProjectTests.createTreeAsync({ [AngularProjectTests.CLI]: String.empty, [AngularProjectTests.LOCKFILE]: lockfile }, false);
    const runner = new ScriptedRunnerFixture(AngularProjectTests.answer());

    const output = await AngularProjectTests.collectAsync(t => AngularProjectTests.create(tree, runner).installAsync(t));

    Assert.areEqual(Resources.angularInstalling + Resources.angularNoBrowser, output);
    Assert.areEqual(1, runner.captured.filter(t => t.endsWith(AngularProjectTests.CI)).length);
    Assert.areEqual(`${process.platform} ${process.arch} ${createHash("sha256").update(lockfile).digest("hex")}\n`, await AngularProjectTests.readRecordAsync(tree));
  }

  @TestMethod
  public async recordsAMissingLockfileAndInstallsOnceForIt(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({ [AngularProjectTests.CLI]: String.empty }, false);
    const runner = new ScriptedRunnerFixture(AngularProjectTests.answer());
    const project = AngularProjectTests.create(tree, runner);

    await project.installAsync(new PassThrough());
    const again = await AngularProjectTests.collectAsync(t => project.installAsync(t));
    await project.prepareAsync(new PassThrough());

    Assert.areEqual(`${process.platform} ${process.arch} none\n`, await AngularProjectTests.readRecordAsync(tree));
    Assert.areEqual(Resources.angularNoBrowser, again);
    Assert.areEqual(1, runner.captured.filter(t => t.endsWith(AngularProjectTests.CI)).length);
  }

  @TestMethod
  public async installsAgainWhenTheAngularCommandLineIsMissing(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({}, true);
    const runner = new ScriptedRunnerFixture(AngularProjectTests.answer());

    const output = await AngularProjectTests.collectAsync(t => AngularProjectTests.create(tree, runner).installAsync(t));

    Assert.areEqual(Resources.angularInstalling + Resources.angularNoBrowser, output);
    Assert.areEqual(1, runner.captured.filter(t => t.endsWith(AngularProjectTests.CI)).length);
  }

  @TestMethod
  public async recordsWithoutInstallingAnAppWithoutAnInstallRecordWhoseNodeModulesHoldsItsLockfile(): Promise<void> {
    const lockfile = AngularProjectTests.lockfile({ "": { name: "app" }, "node_modules/@angular/cli": { version: "22.2.6" } });
    await using tree = await AngularProjectTests.createTreeAsync({
      [AngularProjectTests.CLI]: String.empty,
      [AngularProjectTests.LOCKFILE]: lockfile,
      [AngularProjectTests.INSTALLED]: AngularProjectTests.lockfile({ "node_modules/@angular/cli": { version: "22.2.6" } })
    }, false);
    const runner = new ScriptedRunnerFixture(AngularProjectTests.answer());

    const output = await AngularProjectTests.collectAsync(t => AngularProjectTests.create(tree, runner).installAsync(t));

    Assert.areEqual(Resources.angularAlreadyInstalled + Resources.angularNoBrowser, output);
    Assert.areEqual(0, runner.captured.filter(t => t.endsWith(AngularProjectTests.CI)).length);
    Assert.areEqual(`${process.platform} ${process.arch} ${createHash("sha256").update(lockfile).digest("hex")}\n`, await AngularProjectTests.readRecordAsync(tree));
  }

  @TestMethod
  public async installsAgainForAnInstallRecordOfAnotherLockfileThoughNodeModulesHoldsTheLockfile(): Promise<void> {
    const held = { "node_modules/@angular/cli": { version: "22.2.6" } };
    await using tree = await AngularProjectTests.createTreeAsync({
      [AngularProjectTests.CLI]: String.empty,
      [AngularProjectTests.LOCKFILE]: AngularProjectTests.lockfile(held),
      [AngularProjectTests.INSTALLED]: AngularProjectTests.lockfile(held),
      [AngularProjectTests.RECORD]: `${process.platform} ${process.arch} other\n`
    }, false);
    const runner = new ScriptedRunnerFixture(AngularProjectTests.answer());

    const output = await AngularProjectTests.collectAsync(t => AngularProjectTests.create(tree, runner).installAsync(t));

    Assert.areEqual(Resources.angularInstalling + Resources.angularNoBrowser, output);
    Assert.areEqual(1, runner.captured.filter(t => t.endsWith(AngularProjectTests.CI)).length);
  }

  @TestMethod
  public async installsAgainForAnInstallRecordOfAnotherPlatformThoughNodeModulesHoldsTheLockfile(): Promise<void> {
    await AngularProjectTests.assertInstallsAgainForRecordAsync(t => `${process.platform === "win32" ? "linux" : "win32"} ${process.arch} ${t}\n`);
  }

  @TestMethod
  public async installsAgainForAnInstallRecordOfAnotherArchitectureThoughNodeModulesHoldsTheLockfile(): Promise<void> {
    await AngularProjectTests.assertInstallsAgainForRecordAsync(t => `${process.platform} ${process.arch === "arm64" ? "x64" : "arm64"} ${t}\n`);
  }

  private static async assertInstallsAgainForRecordAsync(record: (hash: string) => string): Promise<void> {
    const lockfile = AngularProjectTests.lockfile({ "node_modules/@angular/cli": { version: "22.2.6" } });
    await using tree = await AngularProjectTests.createTreeAsync({
      [AngularProjectTests.CLI]: String.empty,
      [AngularProjectTests.LOCKFILE]: lockfile,
      [AngularProjectTests.INSTALLED]: lockfile,
      [AngularProjectTests.RECORD]: record(createHash("sha256").update(lockfile).digest("hex"))
    }, false);
    const runner = new ScriptedRunnerFixture(AngularProjectTests.answer());

    const output = await AngularProjectTests.collectAsync(t => AngularProjectTests.create(tree, runner).installAsync(t));

    Assert.areEqual(Resources.angularInstalling + Resources.angularNoBrowser, output);
    Assert.areEqual(1, runner.captured.filter(t => t.endsWith(AngularProjectTests.CI)).length);
  }

  @TestMethod
  public async failsTheInstallWithTheExitCodeAndErrorOutputOfNpm(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({ [AngularProjectTests.CLI]: String.empty }, false);
    const runner = new ScriptedRunnerFixture(AngularProjectTests.answer(new ProcessResult(1, String.empty, "npm ERR! broken\n")));

    const error = await Assert.throwsAsync(() => AngularProjectTests.create(tree, runner).installAsync(new PassThrough()), BuildException);

    Assert.areEqual("\"npm ci\" in the app failed with exit code 1: npm ERR! broken", error.message);
    Assert.isFalse(existsSync(path.join(tree.path, ...AngularProjectTests.RECORD.split("/"))));
  }

  @TestMethod
  public async installsTheBrowserAgainAfterAnAttemptThatFailed(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({ [AngularProjectTests.CLI]: String.empty, [AngularProjectTests.WORKSPACE]: AngularProjectTests.WITH_TEST }, true);
    let attempts = 0;
    const runner = new ScriptedRunnerFixture(AngularProjectTests.answer(ScriptedRunnerFixture.SUCCESS, () => {
      attempts++;
      return attempts === 1 ? new ProcessResult(1, String.empty, "Download failed: server closed connection. URL: https://example.com/chromium.zip\n") : ScriptedRunnerFixture.SUCCESS;
    }));
    const project = AngularProjectTests.create(tree, runner);

    const output = await AngularProjectTests.collectAsync(t => PausedTimersFixture.withoutPausesAsync(() => project.installAsync(t), AngularProjectTests.PAUSE));

    Assert.areEqual(Resources.angularInstallingBrowser + Resources.formatDownloadRetry(Resources.angularBrowserSubject, 1), output);
    Assert.areEqual(2, runner.captured.filter(t => t.endsWith(AngularProjectTests.BROWSER)).length);
  }

  @TestMethod
  public async failsTheBrowserInstallAtOnceWhenItsFailureIsNotANetworkOne(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({ [AngularProjectTests.CLI]: String.empty, [AngularProjectTests.WORKSPACE]: AngularProjectTests.WITH_TEST }, true);
    const failure = "Download failed: server returned code 404 body 'Not Found'. URL: https://example.com/chromium.zip";
    const runner = new ScriptedRunnerFixture(AngularProjectTests.answer(ScriptedRunnerFixture.SUCCESS, () => new ProcessResult(1, String.empty, `${failure}\n`)));
    const project = AngularProjectTests.create(tree, runner);

    const error = await Assert.throwsAsync(() => PausedTimersFixture.withoutPausesAsync(() => project.installAsync(new PassThrough()), AngularProjectTests.PAUSE), BuildException);

    Assert.areEqual(Resources.formatDownloadNotRetried(Resources.angularBrowserSubject, Resources.formatExitCodeProblem(1, failure)), error.message);
    Assert.areEqual(1, runner.captured.filter(t => t.endsWith(AngularProjectTests.BROWSER)).length);
  }

  @TestMethod
  public async findsATestTargetInTheAngularJsonOfAnyFolderOfSource(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({
      [AngularProjectTests.CLI]: String.empty,
      "src/assets/logo.svg": "<svg/>\n",
      "src/lib/angular.json": AngularProjectTests.WITH_TEST,
      "src/notes.md": "Notes\n"
    }, true);
    const runner = new ScriptedRunnerFixture(AngularProjectTests.answer());

    const output = await AngularProjectTests.collectAsync(t => AngularProjectTests.create(tree, runner).installAsync(t));

    Assert.areEqual(Resources.angularInstallingBrowser, output);
    Assert.areEqual(1, runner.captured.filter(t => t.endsWith(AngularProjectTests.BROWSER)).length);
  }

  @TestMethod
  public async refusesAnAngularJsonThatIsNoJson(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({ [AngularProjectTests.CLI]: String.empty, "src/lib/angular.json": "{" }, true);

    const error = await Assert.throwsAsync(() => AngularProjectTests.create(tree, new ScriptedRunnerFixture(AngularProjectTests.answer())).installAsync(new PassThrough()), BuildException);

    Assert.isTrue(error.message.startsWith("src/lib/angular.json could not be read as JSON: "), error.message);
  }

  @TestMethod
  public async removesAnAngularPackageInstalledAsALinkAndTheScopeItLeavesEmpty(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({
      [AngularProjectTests.CLI]: String.empty,
      "linked/window/package.json": JSON.stringify({ name: "@noldova/desktop.window", version: "0.0.3", peerDependencies: { "@angular/core": "22.2.6" } }),
      "node_modules/.vite/deps/chunk.js": String.empty
    }, true);
    await mkdir(path.join(tree.path, "node_modules", "@noldova"), { recursive: true });
    await symlink(path.join(tree.path, "linked", "window"), path.join(tree.path, "node_modules", "@noldova", "desktop.window"), "junction");

    await AngularProjectTests.create(tree, new ScriptedRunnerFixture(AngularProjectTests.answer())).prepareAsync(new PassThrough());

    Assert.isFalse(existsSync(path.join(tree.path, "node_modules", "@noldova")));
    Assert.isFalse(existsSync(path.join(tree.path, "node_modules", ".vite")));
    Assert.isTrue(existsSync(path.join(tree.path, "linked", "window", "package.json")));
  }

  @TestMethod
  public async preparesBuildsAndVerifiesNothingWithoutAWindowProject(): Promise<void> {
    const outputs: string[] = [];
    let ran = 0;
    for (const files of [{ "src/notes.md": "Notes\n" }, { "src/app.window.app/package.json": "{}" }]) {
      await using tree = await SourceTreeFixture.createAsync(files);
      const runner = new ScriptedRunnerFixture(AngularProjectTests.answer());
      const project = AngularProjectTests.create(tree, runner);

      outputs.push(await AngularProjectTests.collectAsync(t => project.prepareAsync(t)));
      outputs.push(await AngularProjectTests.collectAsync(t => project.buildAsync(t, null)));
      await project.verifyWithoutAsync(null, [AngularProjectTests.SECRET]);
      ran += runner.ran.length + runner.captured.length;
    }

    Assert.areEqual(JSON.stringify([Resources.angularNoProject, String.empty, Resources.angularNoProject, String.empty]), JSON.stringify(outputs));
    Assert.areEqual(0, ran);
  }

  @TestMethod
  public async failsTheWindowBuildWithItsExitCode(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({ [AngularProjectTests.CLI]: String.empty }, true);
    const runner = new ScriptedRunnerFixture(AngularProjectTests.answer(), 3);
    const folder = path.join(tree.path, "stage", "window");

    const error = await Assert.throwsAsync(() => AngularProjectTests.create(tree, runner).buildAsync(new PassThrough(), folder), BuildException);

    Assert.areEqual("Building the window failed with exit code 3.", error.message);
    Assert.areEqual(1, runner.ran.filter(t => t.endsWith(` build --output-path ${folder}`)).length);
  }

  @TestMethod
  public async refusesABuiltWindowThatContainsAText(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({ "_build/window/main.js": `const token = "${AngularProjectTests.SECRET}";\n` }, true);

    const error = await Assert.throwsAsync(() => AngularProjectTests.create(tree, new ScriptedRunnerFixture()).verifyWithoutAsync(null, ["other", AngularProjectTests.SECRET]), BuildException);

    Assert.areEqual(`The window built in _build/window contains "${AngularProjectTests.SECRET}" in main.js.`, error.message);
  }

  @TestMethod
  public async scansTheFoldersOfAWindowBuiltElsewhere(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({ "stage/window/browser/main.js": "const token = null;\n" }, true);
    const project = AngularProjectTests.create(tree, new ScriptedRunnerFixture());
    const folder = path.join(tree.path, "stage", "window");

    await project.verifyWithoutAsync(folder, [AngularProjectTests.SECRET]);
    await tree.writeAsync({ "stage/window/browser/main.js": `const token = "${AngularProjectTests.SECRET}";\n` });
    const error = await Assert.throwsAsync(() => project.verifyWithoutAsync(folder, [AngularProjectTests.SECRET]), BuildException);

    Assert.areEqual(`The window built in stage/window contains "${AngularProjectTests.SECRET}" in ${path.join("browser", "main.js")}.`, error.message);
  }

  @TestMethod
  public async refusesABuiltWindowWithoutFiles(): Promise<void> {
    await using tree = await AngularProjectTests.createTreeAsync({}, true);
    await mkdir(path.join(tree.path, "_build", "window", "browser"), { recursive: true });

    const error = await Assert.throwsAsync(() => AngularProjectTests.create(tree, new ScriptedRunnerFixture()).verifyWithoutAsync(null, [AngularProjectTests.SECRET]), BuildException);

    Assert.areEqual("The window built in _build/window has no files to check.", error.message);
  }

  private static async createTreeAsync(files: Readonly<Record<string, string>>, isRecorded: boolean): Promise<SourceTreeFixture> {
    const tree = await SourceTreeFixture.createAsync({ [AngularProjectTests.WORKSPACE]: AngularProjectTests.BUILD_ONLY, ...files });
    const lockfile = path.join(tree.path, AngularProjectTests.LOCKFILE);
    const hash = existsSync(lockfile) ? createHash("sha256").update(await readFile(lockfile)).digest("hex") : "none";
    if (isRecorded)
      await tree.writeAsync({ [AngularProjectTests.RECORD]: `${process.platform} ${process.arch} ${hash}\n` });
    return tree;
  }

  private static create(tree: SourceTreeFixture, runner: ScriptedRunnerFixture): AngularProject {
    return new AngularProject(tree.path, runner, new NpmCommand(runner, { npm_execpath: path.join(tree.path, AngularProjectTests.NPM) }));
  }

  private static answer(ci: ProcessResult = ScriptedRunnerFixture.SUCCESS, browser: () => ProcessResult = () => ScriptedRunnerFixture.SUCCESS): (command: string, commandArguments: readonly string[]) => ProcessResult {
    return (_command, commandArguments) => {
      if (commandArguments[1] === "ci")
        return ci;
      if (commandArguments[1] === "ls")
        return new ProcessResult(0, "{}", String.empty);
      return browser();
    };
  }

  private static lockfile(packages: Readonly<Record<string, unknown>>): string {
    return JSON.stringify({ name: "app", lockfileVersion: 3, packages });
  }

  private static async readRecordAsync(tree: SourceTreeFixture): Promise<string> {
    return await readFile(path.join(tree.path, ...AngularProjectTests.RECORD.split("/")), "utf8");
  }

  private static async collectAsync(run: (output: Writable) => Promise<unknown>): Promise<string> {
    const chunks: string[] = [];
    const output = new Writable({
      write: (chunk: Buffer, _encoding, callback): void => {
        chunks.push(chunk.toString());
        callback();
      }
    });
    await run(output);
    return chunks.join(String.empty);
  }

  private static async runAsync(app: AppFolderFixture, ...commandArguments: readonly string[]): Promise<string> {
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on("data", (chunk: Buffer) => chunks.push(chunk.toString()));
    await new BuildCommandLine(app.path, app.environment, process.platform, process.arch, output, new PassThrough()).runAsync(commandArguments);
    return chunks.join(String.empty);
  }
}
