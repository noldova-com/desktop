/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync, type FSWatcher, watch } from "node:fs";
import { appendFile, copyFile, mkdir, open, readdir, readFile, readlink, rename, stat } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";
import timers from "node:timers/promises";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { BuildException } from "../../exceptions/build.exception.ts";
import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { RootManifest } from "../../models/packages/root-manifest.ts";
import type { InstalledPackage } from "../../models/packaging/installed-package.ts";
import type { ISmokeCopy } from "../../interfaces/i-smoke-copy.ts";
import { PackageInstaller } from "../packaging/package-installer.ts";
import { PackageLayout } from "../packaging/package-layout.ts";
import { PackagedArchitecture } from "../packaging/packaged-architecture.ts";
import { PackagedModules } from "../packaging/packaged-modules.ts";
import { PackagedWindow } from "../packaging/packaged-window.ts";
import { PackagedSandbox } from "../packaging/packaged-sandbox.ts";
import { PackagedPublisherCheck } from "../packaging/packaged-publisher-check.ts";
import { PackagedUnpackedFiles } from "../packaging/packaged-unpacked-files.ts";
import { DebianInstall } from "../packaging/debian-install.ts";
import type { ISystemInstall } from "../../interfaces/i-system-install.ts";
import { MacInstall } from "../packaging/mac-install.ts";
import { ExtractedCopy } from "../packaging/extracted-copy.ts";
import { MountedAppImage } from "../packaging/mounted-app-image.ts";
import { SmokeAnswer } from "../packaging/smoke-answer.ts";
import { SandboxValidator } from "../desktop/sandbox.validator.ts";
import { UserNamespaces } from "../desktop/user-namespaces.ts";
import { ModuleCatalog } from "../modules/module-catalog.ts";
import { PackageReport } from "../../models/packaging/package-report.ts";
import { PackageTarget } from "../../models/packaging/package-target.ts";
import { UserPath } from "../packaging/user-path.ts";
import type { ProcessResult } from "../../models/processes/process-result.ts";
import { ProcessRunner } from "../processes/process-runner.ts";
import type { StartedProcess } from "../processes/started-process.ts";
import { TemporaryFolder } from "../processes/temporary-folder.ts";
import { Resources } from "../../resources.ts";

export class PackageSmoke {
  private readonly root: string;
  private readonly platform: string;
  private readonly architecture: string;
  private readonly runner: ProcessRunner;
  private readonly temporaryFolder: TemporaryFolder;
  private readonly processes: string;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private slug: string = String.empty;
  private folder: string | null = null;
  private runtime: number | null = null;
  private hasRuntimeOutlived: boolean = false;
  private hasRuntimeStopped: boolean = false;
  private sandboxOption: string | null = null;
  private isDebian: boolean = false;
  private isMacInstaller: boolean = false;
  private system: ISystemInstall | null = null;

  public constructor(root: string, platform: string, architecture: string, runner: ProcessRunner, temporaryFolder: TemporaryFolder, processes: string, environment: NodeJS.ProcessEnv, output: Writable) {
    this.root = root;
    this.platform = platform;
    this.architecture = architecture;
    this.runner = runner;
    this.temporaryFolder = temporaryFolder;
    this.processes = processes;
    this.environment = environment;
    this.output = output;
  }

  public async runAsync(smokeArguments: readonly string[]): Promise<number> {
    const isDebian = smokeArguments[0] === Resources.smokeDebianOption;
    const isMacInstaller = smokeArguments[0] === Resources.smokeMacInstallerOption;
    const rest = isDebian || isMacInstaller ? smokeArguments.slice(1) : smokeArguments;
    const [option] = rest;
    if (rest.length > 1 || (!Object.isUndefined(option) && !(isDebian ? Resources.smokeSandboxOptions : isMacInstaller ? [] : Resources.smokeOptions).includes(option))) {
      this.output.write(Resources.smokeUsage);
      return Resources.usageExitCode;
    }
    if (option === Resources.smokeRemoveLeftoverOption)
      return this.removeLeftoverAsync();

    this.sandboxOption = option ?? null;
    this.isDebian = isDebian;
    this.isMacInstaller = isMacInstaller;
    this.system = null;

    this.folder = null;
    this.runtime = null;
    this.hasRuntimeOutlived = false;
    this.hasRuntimeStopped = false;
    let hasFailed = false;
    try {
      await this.checkAsync();
    }
    catch (error) {
      const isKnown = error instanceof BuildException;
      if (isKnown)
        this.output.write(Resources.formatOutputLine(error.message));
      await this.cleanUpAsync();
      if (!isKnown)
        throw error;
      hasFailed = true;
    }
    if (hasFailed || !await this.cleanUpAsync())
      return Resources.failureExitCode;
    await PackageReport.markStartedAsync(new PackageLayout(this.root).report);
    return 0;
  }

  private get extractsAndRuns(): boolean {
    return this.environment[Resources.appImageExtractAndRunVariable] === Resources.appImageExtractAndRunValue;
  }

  private async removeLeftoverAsync(): Promise<number> {
    let removed: string | null = null;
    if (PackageTarget.fromProcess(this.platform, this.architecture).platform === Resources.windowsTarget)
      removed = await new PackageInstaller(this.root, this.runner, this.environment)
        .removeWindowsLeftoverAsync(await ProductIdentity.readAsync(this.root), this.root, new UserPath(this.runner, this.root));
    this.output.write(Resources.formatOutputLine(removed ?? Resources.smokeNothingLeft));
    return 0;
  }

  private async checkAsync(): Promise<void> {
    const running = PackageTarget.fromProcess(this.platform, this.architecture);
    if (this.isDebian && running.platform !== Resources.linuxTarget)
      throw new BuildException(Resources.smokeDebianNotLinux);
    const publisher = this.environment[Resources.windowsPublisherVariable] ?? String.empty;
    delete this.environment[Resources.windowsPublisherVariable];
    const manifest = await RootManifest.readAsync(this.root);
    const product = await ProductIdentity.readAsync(this.root);
    const target = running.withInstallFolder(product.installFolder);
    if (this.isMacInstaller && (target.platform !== Resources.macosTarget || !target.isFoldered))
      throw new BuildException(Resources.smokeMacInstallerNotFoldered);
    this.slug = product.slug;
    const folder = await this.temporaryFolder.createAsync(this.platform, Resources.smokeFolderPrefix);
    this.folder = folder;
    const installer = new PackageInstaller(this.root, this.runner, this.environment);
    const userPath = new UserPath(this.runner, folder);
    if (target.platform === Resources.windowsTarget)
      this.output.write(Resources.formatOutputLine(await installer.removeWindowsLeftoverAsync(product, folder, userPath) ?? Resources.smokeNothingLeft));
    const pathBefore = target.platform === Resources.windowsTarget ? await userPath.readAsync() : null;
    const started = Date.now();
    const installed = this.isDebian ? await this.installDebianAsync(target, product, manifest.productVersion, folder)
      : this.isMacInstaller ? await this.installMacAsync(target, product, manifest.productVersion, folder) : await installer.installAsync(target, product, manifest.productVersion, folder);
    this.output.write(Resources.formatSmokeInstalled((Date.now() - started) / Resources.millisecondsPerSecond, installed.mainProcess));
    if (!Object.isNull(this.system))
      this.output.write(Resources.formatOutputLine(await this.system.verifyAsync()));
    if (target.platform === Resources.macosTarget)
      this.output.write(Resources.formatOutputLine(await PackagedArchitecture.verifyAsync(path.resolve(installed.program, ...Resources.macBundleFromProgram), target.architecture, target.platform)));
    await this.checkCookieEncryptionAsync(target, installed);
    this.output.write(Resources.formatOutputLine(await PackagedPublisherCheck.verifyAsync(path.join(installed.resources, Resources.packagedArchiveFile), publisher.length === 0 ? null : publisher)));
    this.output.write(Resources.formatOutputLine(await PackagedUnpackedFiles.verifyAsync(installed.resources, new PackageLayout(this.root).configuration)));
    if (!Object.isNull(installed.command))
      await this.requireOnPathAsync(userPath, installed.command, Resources.smokePathHoldsIntro);
    const data = path.join(folder, Resources.smokeDataFolder);
    await this.requireNoRuntimeAsync(installed, data, folder, Resources.smokeMomentBeforeStart);
    this.output.write(Resources.formatSmokeNoRuntimeBeforeStart(this.slug));

    const log = path.join(folder, Resources.smokeMainLogFile);
    const logs = [log, path.join(data, ...Resources.smokeDataLogSegments)];
    const isSandboxed = target.platform === Resources.linuxTarget && await this.isSandboxExpectedAsync(folder);
    const mainProcess = await this.startMainProcessAsync(installed, data, folder, log);
    let runtime: number;
    let copy: ISmokeCopy | null = null;
    try {
      const answer = await this.waitForRuntimeAsync(installed, data, folder, mainProcess, logs);
      this.checkStarted(answer, manifest.productVersion, data, Resources.smokeMomentAfterStart);
      const declared = await new ModuleCatalog(this.root).listBuildAsync(false, []);
      this.output.write(Resources.formatOutputLine(PackagedModules.verify(SmokeAnswer.read(answer, t => t.toJson()), declared, target.platform)));
      this.output.write(Resources.formatOutputLine(await PackagedWindow.waitAsync({
        limit: Resources.smokeStartLimit,
        mainProcess,
        queryAsync: () => this.queryStatusAsync(installed, data, folder),
        readTailAsync: () => PackageSmoke.readTailAsync(logs),
        pauseAsync: () => timers.setTimeout(Resources.smokePollInterval),
        now: () => Date.now()
      }, product.name)));
      if (target.platform === Resources.linuxTarget)
        this.output.write(Resources.formatOutputLine(await new PackagedSandbox(this.processes, { now: () => Date.now(), pauseAsync: timers.setTimeout }).verifyAsync(mainProcess.id, isSandboxed)));
      if (target.platform === Resources.linuxTarget)
        await (Object.isNull(this.system)
          ? this.checkWindowlessCommandAsync(installed.mainProcess, [Resources.commandLineOption], Resources.smokeMomentAppImageCommandLine, manifest.productVersion, data, folder)
          : this.checkWindowlessCommandAsync(path.posix.join(Resources.linuxCommandFolder, product.slug), [], Resources.smokeMomentDebianCommand, manifest.productVersion, data, folder));
      if (!Object.isNull(installed.command))
        await this.checkPowerShellAsync(installed.command, manifest.productVersion, data, folder);
      const found = await PackageSmoke.readRuntimeIdAsync(data);
      if (Object.isNull(found))
        throw new BuildException(Resources.formatSmokeDiscoveryNamesNoProcess(path.join(data, ...Resources.runtimeDiscoverySegments)));
      runtime = found;
      this.track(runtime);
      if (target.platform === Resources.linuxTarget && Object.isNull(this.system)) {
        copy = await this.requireCopyAsync(data, runtime, mainProcess, logs);
        await this.replaceAppImageAsync(installed, manifest.productVersion, data, folder, runtime);
      }
      if (target.platform === Resources.macosTarget) {
        await this.checkLinkedCommandAsync(path.join(installed.resources, Resources.commandFolder, product.slug), manifest.productVersion, data, folder);
        await this.captureScreenAsync(target, folder);
      }

      await this.quitAsync(installed, data, folder);
      if (!await mainProcess.waitAsync(Resources.smokeQuitLimit))
        throw new BuildException(Resources.formatSmokeMainDidNotExit(this.slug, await PackageSmoke.readTailAsync(logs)));
      if (mainProcess.exitCode !== 0)
        throw new BuildException(Resources.formatSmokeMainQuitBadly(mainProcess.ending, await PackageSmoke.readTailAsync(logs)));
      this.output.write(Resources.smokeMainQuit);
      if (!Object.isNull(copy))
        await copy.requireOutlivesAsync(runtime, Resources.smokeMomentQuit);
    }
    finally {
      if (!mainProcess.hasExited)
        mainProcess.signal(Resources.killSignal);
    }
    if (!await this.waitForExitAsync(runtime, Resources.smokeStopLimit)) {
      this.hasRuntimeOutlived = true;
      throw new BuildException(Resources.formatSmokeRuntimeOutlived(runtime, await PackageSmoke.readTailAsync(logs)));
    }
    this.track(null);
    await this.requireNoRuntimeAsync(installed, data, folder, Resources.smokeMomentAfterRuntimeStopped);
    this.output.write(Resources.smokeRuntimeStopped);
    if (!Object.isNull(copy)) {
      await this.requireCopyEndedAsync(copy, Resources.smokeMomentStopped, path.join(data, ...Resources.smokeRuntimeLogSegments));
      await copy.checkKilledAsync({
        installed,
        data,
        folder,
        startMainProcessAsync: this.startMainProcessAsync.bind(this),
        waitForRuntimeAsync: this.waitForRuntimeAsync.bind(this),
        readRuntimeIdAsync: PackageSmoke.readRuntimeIdAsync,
        requireCopyAsync: this.requireCopyAsync.bind(this),
        waitForExitAsync: this.waitForExitAsync.bind(this),
        requireCopyEndedAsync: this.requireCopyEndedAsync.bind(this),
        track: this.track.bind(this)
      });
    }
    if (!Object.isNull(this.system)) {
      const system = this.system;
      this.system = null;
      this.output.write(Resources.formatOutputLine(await system.removeAsync()));
    }
    if (Object.isNull(installed.command))
      return;
    await installer.installAsync(target, product, manifest.productVersion, folder);
    await this.requireOnPathAsync(userPath, installed.command, Resources.smokePathHoldsAgainIntro);
    await installer.uninstallWindowsAsync(target, product, manifest.productVersion, folder);
    const pathAfter = await userPath.readAsync();
    if (pathAfter !== pathBefore)
      throw new BuildException(Resources.formatSmokePathChanged(pathAfter, pathBefore));
    this.output.write(Resources.smokeUninstalled);
  }

  private async installDebianAsync(target: PackageTarget, product: ProductIdentity, version: string, folder: string): Promise<InstalledPackage> {
    const file = path.join(new PackageLayout(this.root).output, target.formatFileName(product.name, version, Resources.debianPackageTarget));
    this.system = await DebianInstall.installAsync(this.runner, file, product.slug, product.installFolder, folder, product.applicationId);
    return this.system.installed;
  }

  private async installMacAsync(target: PackageTarget, product: ProductIdentity, version: string, folder: string): Promise<InstalledPackage> {
    const file = path.join(new PackageLayout(this.root).output, target.formatFileName(product.name, version, Resources.macInstallerTarget));
    this.system = await MacInstall.installAsync(this.runner, file, product, folder);
    return this.system.installed;
  }

  private async checkCookieEncryptionAsync(target: PackageTarget, installed: InstalledPackage): Promise<void> {
    const binary = target.platform === Resources.macosTarget ? path.join(installed.resources, ...Resources.macFuseBinarySegments) : installed.program;
    const isEncrypted = PackageSmoke.readFuse(binary, await readFile(binary), Resources.cookieEncryptionFuse);
    const hasWebViews = await new ModuleCatalog(this.root).hasWebViewsAsync();
    if (isEncrypted !== hasWebViews)
      throw new BuildException(hasWebViews ? Resources.formatSmokeCookiesUnencrypted(binary) : Resources.formatSmokeCookiesEncrypted(binary));
    this.output.write(Resources.formatSmokeCookieEncryption(isEncrypted));
  }

  private async requireOnPathAsync(userPath: UserPath, command: string, intro: string): Promise<void> {
    const entry = path.dirname(command);
    const value = await userPath.readAsync();
    const count = UserPath.count(value, entry);
    if (count !== 1)
      throw new BuildException(Resources.formatSmokePathCount(entry, count, value));
    this.output.write(Resources.formatSmokePathHolds(intro, entry));
  }

  private async checkPowerShellAsync(command: string, version: string, data: string, folder: string): Promise<void> {
    const line = Resources.formatPowerShellStatusLine(path.parse(command).name, path.join(folder, Resources.smokeDeviceFolder), data);
    const status = await this.runner.captureAsync(Resources.powershellCommand, [...Resources.powerShellOptions, line], folder, Resources.smokeCommandLimit, this.createCommandEnvironment(command));
    if (!status.isSuccessful)
      throw new BuildException(Resources.formatSmokePowerShellFailed(this.slug, status.exitCode, status.text));
    this.checkStarted(status.output, version, data, Resources.smokeMomentPowerShell);
  }

  private async checkLinkedCommandAsync(command: string, version: string, data: string, folder: string): Promise<void> {
    const link = path.join(folder, path.basename(command));
    await this.runner.requireAsync(Resources.linkCommand, [Resources.linkSymbolicOption, command, link], folder, Resources.smokeCommandLimit);
    const status = await this.runner.captureAsync(link, PackageSmoke.formatArguments(Resources.smokeStatusArguments, data, folder), folder, Resources.smokeCommandLimit, this.environment);
    if (!status.isSuccessful)
      throw new BuildException(Resources.formatSmokeLinkFailed(this.slug, command, status.exitCode, status.text));
    this.checkStarted(status.output, version, data, Resources.smokeMomentLink);
  }

  private async checkWindowlessCommandAsync(command: string, commandArguments: readonly string[], moment: string, version: string, data: string, folder: string): Promise<void> {
    const environment = Object.fromEntries(Object.entries(this.environment).filter(([name]) => !Resources.displayVariables.includes(name)));
    const status = await this.runner.captureAsync(command, PackageSmoke.formatArguments([...commandArguments, ...Resources.smokeStatusArguments], data, folder), folder,
      Resources.smokeCommandLimit, environment);
    if (!status.isSuccessful)
      throw new BuildException(Resources.formatSmokeWindowlessCommandFailed(this.slug, moment, status.exitCode, status.text));
    this.checkStarted(status.output, version, data, moment);
  }

  private createCommandEnvironment(command: string): NodeJS.ProcessEnv {
    const isPath = ([name]: readonly [string, unknown]): boolean => name.toUpperCase() === Resources.pathVariable;
    const paths = Object.entries(this.environment).filter(t => isPath(t)).map(([, value]) => String(value));
    const others = Object.entries(this.environment).filter(t => !isPath(t));
    return { ...Object.fromEntries(others), [Resources.pathVariable]: [path.dirname(command), ...paths].join(path.win32.delimiter) };
  }

  private async isSandboxExpectedAsync(folder: string): Promise<boolean> {
    if (this.sandboxOption === Resources.chromiumNoSandboxOption) {
      this.output.write(Resources.smokeNoSandboxNotice);
      return false;
    }
    if (this.sandboxOption === Resources.smokeRequireSandboxOption) {
      this.output.write(Resources.smokeRequireSandboxNotice);
      return true;
    }
    if (this.sandboxOption === Resources.smokeRequireFallbackOption) {
      this.output.write(Resources.smokeRequireFallbackNotice);
      return false;
    }
    if (this.isDebian) {
      this.output.write(Resources.smokeDebianSandboxNotice);
      return true;
    }
    const refusal = await UserNamespaces.findRefusalAsync(t => SandboxValidator.readOptionalTextAsync(path.join(this.processes, t.slice(Resources.procFolder.length))));
    const canEnter = await UserNamespaces.canEnterAsync(async (command, commandArguments) =>
      (await this.runner.captureAsync(command, commandArguments, folder, Resources.smokeNamespaceProbeLimit)).exitCode);
    if (!canEnter)
      this.output.write(Resources.formatSmokeProbeFails(refusal));
    else if (!Object.isNull(refusal))
      this.output.write(Resources.formatSmokeProbeRuns(refusal));
    return canEnter;
  }

  private startMainProcessAsync(installed: InstalledPackage, data: string, folder: string, log: string): Promise<StartedProcess> {
    const options = [Resources.formatOptionValue(Resources.deviceDirectoryOption, path.join(folder, Resources.smokeDeviceFolder)), Resources.formatOptionValue(Resources.dataDirectoryOption, data)];
    if (this.sandboxOption === Resources.chromiumNoSandboxOption)
      options.push(Resources.chromiumNoSandboxOption);
    return this.runner.startAsync(installed.mainProcess, options, folder, log);
  }

  private async requireCopyAsync(data: string, runtime: number, mainProcess: StartedProcess, mainLogs: readonly string[]): Promise<ISmokeCopy> {
    const logs = path.join(data, Resources.logsFolder);
    await PackageSmoke.waitForLaunchAsync(logs, mainProcess, mainLogs);
    const records = (await readdir(logs)).filter(t => Resources.smokeCopyRecordPattern.test(t)).map(t => path.join(logs, t));
    if (this.extractsAndRuns) {
      const [record = String.empty] = records;
      const extraction = records.length === 1 ? SmokeAnswer.read(await readFile(record, Resources.textEncoding), t => t.readString(Resources.copyRecordExtractionField)) : null;
      if (Object.isNull(extraction) || !existsSync(extraction))
        throw new BuildException(Resources.formatSmokeExtractionRecords(logs, records.length));
      this.output.write(Resources.formatSmokeExtraction(extraction, await PackageSmoke.measureAsync(extraction)));
      return new ExtractedCopy(record, extraction);
    }
    if (records.length > 0) {
      const texts = await Promise.all(records.map(t => readFile(t, Resources.textEncoding).catch((error: unknown) => String(error))));
      throw new BuildException(Resources.formatSmokeMountedCopyRecords(logs, records.length, texts));
    }
    return await MountedAppImage.findAsync(this.processes, readlink, runtime, this.runner, PackageSmoke.readRuntimeIdAsync.bind(PackageSmoke, data), this.output);
  }

  private async replaceAppImageAsync(installed: InstalledPackage, version: string, data: string, folder: string, runtime: number): Promise<void> {
    const replacement = `${installed.mainProcess}${Resources.smokeReplacementSuffix}`;
    await copyFile(installed.mainProcess, replacement);
    await rename(replacement, installed.mainProcess);
    const program = await readlink(path.join(this.processes, String(runtime), Resources.procProgramLink));
    const magic = Buffer.alloc(Resources.elfMagic.length);
    const file = await open(program);
    try {
      await file.read(magic, 0, magic.length, 0);
    }
    finally {
      await file.close();
    }
    if (magic.toString(Resources.elfMagicEncoding) !== Resources.elfMagic)
      throw new BuildException(Resources.formatSmokeProgramUnreadable(program));
    const status = await this.queryStatusAsync(installed, data, folder);
    if (!status.isSuccessful)
      throw new BuildException(Resources.formatSmokeStatusAfterReplace(this.slug, status.exitCode, status.text));
    this.checkStarted(status.output, version, data, Resources.smokeMomentReplaced);
  }

  private static async measureAsync(folder: string): Promise<number> {
    let size = 0;
    for (const entry of (await readdir(folder, { recursive: true, withFileTypes: true })).filter(t => t.isFile()))
      size += (await stat(path.join(entry.parentPath, entry.name))).size;
    return size;
  }

  private async requireCopyEndedAsync(copy: ISmokeCopy, moment: string, log: string): Promise<void> {
    const started = Date.now();
    while (await copy.isPresentAsync()) {
      if (Date.now() - started >= Resources.smokeKillLimit)
        throw new BuildException(Resources.formatSmokeCopyLingered(moment, copy.items, await PackageSmoke.readTailAsync([log])));
      await timers.setTimeout(Resources.smokePollInterval);
    }
    this.output.write(Resources.formatSmokeCopyEnded(moment));
  }

  private track(runtime: number | null): void {
    this.runtime = runtime;
    this.hasRuntimeStopped = Object.isNull(runtime);
  }

  private async cleanUpAsync(): Promise<boolean> {
    if (Object.isNull(this.folder))
      return true;
    const problems: string[] = [];
    const ending = await this.endRuntimeAsync(this.folder);
    if (!Object.isNull(ending))
      problems.push(ending);
    const system = this.system;
    this.system = null;
    if (!Object.isNull(system)) {
      try {
        this.output.write(Resources.formatOutputLine(await system.removeAsync()));
      }
      catch (error) {
        problems.push(Resources.formatSmokeSystemInstallNotRemoved(system.packageName, error));
      }
    }
    try {
      await this.temporaryFolder.removeAsync(this.folder);
    }
    catch (error) {
      problems.push(Resources.formatSmokeFolderNotRemoved(this.folder, error));
    }
    this.folder = null;
    if (problems.length > 0)
      this.output.write(Resources.formatSmokeCleanUpFailed(problems));
    return problems.length === 0;
  }

  private async endRuntimeAsync(folder: string): Promise<string | null> {
    let runtime = this.runtime;
    try {
      if (Object.isNull(runtime) && !this.hasRuntimeStopped)
        runtime = await PackageSmoke.readRuntimeIdAsync(path.join(folder, Resources.smokeDataFolder));
      if (Object.isNull(runtime) || (!this.hasRuntimeOutlived && await this.waitForExitAsync(runtime, Resources.smokeStopLimit)))
        return null;
      this.runner.kill(runtime);
      if (await this.waitForExitAsync(runtime, Resources.smokeKillLimit))
        return null;
      return Resources.formatSmokeRuntimeNotEnded(runtime);
    }
    catch (error) {
      if (Object.isNull(runtime))
        return Resources.formatSmokeDiscoveryUnreadable(folder, error);
      return Resources.formatSmokeRuntimeEndFailed(runtime, error);
    }
  }

  private static async readTailAsync(logs: readonly string[]): Promise<string> {
    const tails: string[] = [];
    for (const log of logs.filter(t => existsSync(t)))
      tails.push(Resources.formatSmokeLogTail(log, (await readFile(log, Resources.textEncoding)).slice(-Resources.smokeLogTailLength)));
    return tails.join(Resources.lineSeparator);
  }

  private static readFuse(binary: string, content: Buffer, fuse: number): boolean {
    const sentinel = content.indexOf(Resources.electronFuseSentinel);
    const wire = sentinel + Resources.electronFuseSentinel.length;
    const state = content[wire + Resources.electronFuseHeaderLength + fuse];
    if (sentinel < 0 || content[wire] !== Resources.electronFuseWireVersion || fuse >= (content[wire + 1] ?? 0)
      || (state !== Resources.electronFuseEnabled && state !== Resources.electronFuseDisabled))
      throw new BuildException(Resources.formatSmokeNoFuseWire(binary, fuse));
    return state === Resources.electronFuseEnabled;
  }

  private static async readRuntimeIdAsync(data: string): Promise<number | null> {
    const file = path.join(data, ...Resources.runtimeDiscoverySegments);
    return existsSync(file) ? SmokeAnswer.read(await readFile(file, Resources.textEncoding), t => t.readNumber(Resources.discoveryProcessIdField)) : null;
  }

  private runCommandLineAsync(installed: InstalledPackage, commandArguments: readonly string[], data: string, folder: string, limit: number): Promise<ProcessResult> {
    if (!Object.isNull(installed.command)) {
      return this.runner.captureAsync(Resources.windowsCommandShell,
        [...Resources.windowsCommandShellOptions, path.parse(installed.command).name, ...PackageSmoke.formatArguments(commandArguments, data, folder)],
        folder, limit, this.createCommandEnvironment(installed.command));
    }
    return this.runner.captureAsync(installed.program,
      [path.join(installed.resources, Resources.packagedArchiveFile, ...Resources.desktopToolsEntrySegments), ...PackageSmoke.formatArguments(commandArguments, data, folder)],
      folder, limit, { ...this.environment, [Resources.runAsNodeVariable]: Resources.runAsNodeValue });
  }

  private queryStatusAsync(installed: InstalledPackage, data: string, folder: string): Promise<ProcessResult> {
    return this.runCommandLineAsync(installed, Resources.smokeStatusArguments, data, folder, Resources.smokeCommandLimit);
  }

  private static formatArguments(commandArguments: readonly string[], data: string, folder: string): readonly string[] {
    return [...commandArguments, Resources.deviceDirectoryOption, path.join(folder, Resources.smokeDeviceFolder), Resources.dataDirectoryOption, data];
  }

  private async requireNoRuntimeAsync(installed: InstalledPackage, data: string, folder: string, moment: string): Promise<void> {
    const status = await this.queryStatusAsync(installed, data, folder);
    if (status.exitCode !== Resources.smokeNoRuntimeExitCode)
      throw new BuildException(Resources.formatSmokeStatusNotNoRuntime(this.slug, moment, status.exitCode, status.text));
  }

  private async waitForRuntimeAsync(installed: InstalledPackage, data: string, folder: string, mainProcess: StartedProcess, logs: readonly string[]): Promise<string> {
    const started = Date.now();
    for (;;) {
      const status = await this.queryStatusAsync(installed, data, folder);
      if (status.isSuccessful)
        return status.output;
      if (mainProcess.hasExited)
        throw new BuildException(Resources.formatSmokeMainEndedBeforeRuntime(mainProcess.ending, await PackageSmoke.readTailAsync(logs)));
      if (Date.now() - started >= Resources.smokeStartLimit)
        throw new BuildException(Resources.formatSmokeRuntimeNoAnswer(this.slug, status.exitCode, status.text, await PackageSmoke.readTailAsync(logs)));
      await timers.setTimeout(Resources.smokePollInterval);
    }
  }

  private static async waitForLaunchAsync(logs: string, mainProcess: StartedProcess, mainLogs: readonly string[]): Promise<void> {
    const removed = Promise.withResolvers<boolean>();
    const limit = new AbortController();
    const fail = (error: unknown): void => removed.reject(new BuildException(Resources.formatSmokeLogsUnwatchable(logs), new ExceptionOptions(error)));
    const check = (): void => void PackageSmoke.hasStartLogAsync(logs).then(t => {
      if (!t)
        removed.resolve(true);
    }, removed.reject);
    const watchers: FSWatcher[] = [];
    const recheck = setInterval(check, Resources.smokePollInterval);
    try {
      try {
        for (const name of (await readdir(logs)).filter(t => Resources.smokeStartLogPattern.test(t)))
          PackageSmoke.watchStartLog(path.join(logs, name), check, fail, watchers);
      }
      catch (error) {
        fail(error);
      }
      const isRemoved = await Promise.race([removed.promise, PackageSmoke.waitForLaunchEndingAsync(logs, mainProcess, mainLogs, limit.signal)]);
      if (!isRemoved)
        throw new BuildException(Resources.formatSmokeMainEndedBeforeLauncher(mainProcess.ending, await PackageSmoke.readTailAsync(mainLogs)));
    }
    finally {
      clearInterval(recheck);
      limit.abort();
      for (const watcher of watchers)
        watcher.close();
    }
  }

  private static watchStartLog(file: string, check: () => void, fail: (error: unknown) => void, watchers: FSWatcher[]): void {
    try {
      watchers.push(watch(file, check).once(Resources.errorEvent, fail));
    }
    catch (error) {
      if (existsSync(file))
        throw error;
    }
  }

  private static async waitForLaunchEndingAsync(logs: string, mainProcess: StartedProcess, mainLogs: readonly string[], signal: AbortSignal): Promise<boolean> {
    if (!await PackageSmoke.hasStartLogAsync(logs))
      return true;
    return await Promise.race([
      mainProcess.waitForExitAsync().then(async () => !await PackageSmoke.hasStartLogAsync(logs)),
      timers.setTimeout(Resources.smokeStartLimit, undefined, { signal }).then(async () => {
        throw new BuildException(Resources.formatSmokeLauncherKeptStartLog(logs, await PackageSmoke.readTailAsync(mainLogs)));
      })
    ]);
  }

  private static async hasStartLogAsync(logs: string): Promise<boolean> {
    return (await readdir(logs)).some(t => Resources.smokeStartLogPattern.test(t));
  }

  private checkStarted(answer: string, version: string, data: string, moment: string): void {
    const reportedVersion = SmokeAnswer.read(answer, t => t.readObject(Resources.statusBuildField).readString(Resources.statusVersionField));
    const directory = SmokeAnswer.read(answer, t => t.readString(Resources.statusDataDirectoryField));
    if (Object.isNull(reportedVersion) || Object.isNull(directory))
      throw new BuildException(Resources.formatSmokeStatusIncomplete(this.slug, answer));
    if (reportedVersion !== version || directory !== data)
      throw new BuildException(Resources.formatSmokeStatusMismatch(this.slug, reportedVersion, directory, version, data));
    this.output.write(Resources.formatSmokeStatusReported(this.slug, moment, reportedVersion, directory));
  }

  private async waitForExitAsync(runtime: number, limit: number): Promise<boolean> {
    const started = Date.now();
    while (this.runner.isRunning(runtime)) {
      if (Date.now() - started >= limit)
        return false;
      await timers.setTimeout(Resources.smokePollInterval);
    }
    return true;
  }

  private async captureScreenAsync(target: PackageTarget, folder: string): Promise<void> {
    const evidence = new PackageLayout(this.root).smoke;
    const file = path.join(evidence, Resources.formatSmokeScreenshotFile(target.platform, target.architecture));
    await mkdir(evidence, { recursive: true });
    const result = await this.runner.captureAsync(Resources.smokeScreenCaptureCommand, [Resources.smokeSilentCaptureOption, file], folder, Resources.smokeCommandLimit);
    if (result.isSuccessful) {
      this.output.write(Resources.formatSmokeScreenCaptured(file));
      return;
    }
    const reason = Resources.formatSmokeScreenNotCaptured(result.exitCode, result.text);
    this.output.write(reason);
    const summary = this.environment[Resources.githubStepSummaryVariable] ?? String.empty;
    if (summary.length > 0)
      await appendFile(summary, reason);
  }

  private async quitAsync(installed: InstalledPackage, data: string, folder: string): Promise<void> {
    const quit = await this.runCommandLineAsync(installed, Resources.smokeQuitArguments, data, folder, Resources.smokeQuitLimit + Resources.smokeCommandLimit);
    if (!quit.isSuccessful || SmokeAnswer.read(quit.output, t => t.readValue(Resources.quitOutcomeField)) !== Resources.quitOutcome)
      throw new BuildException(Resources.formatSmokeQuitOutcomeWrong(this.slug, quit.exitCode, quit.text));
  }
}
