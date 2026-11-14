/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { EventEmitter } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough, type Readable } from "node:stream";
import { pathToFileURL } from "node:url";

import "@noldova/context.core";
import { Cli, CliContext } from "@noldova/desktop.cli";
import type { BuildIdentity } from "@noldova/desktop.protocol";
import {
  DataDirectory, DeviceFolder, DiscoveryReader, type IProcessStarter, ModuleDeclarationReader, OwnershipLock, ProcessPresence, RuntimeBuild, RuntimeEntry, RuntimeHost, RuntimeOptions,
  ServerSettings
} from "@noldova/desktop.runtime";

import { FakeMainProcessOpenerFixture } from "./fake-main-process-opener.fixture.js";
import type { ProbeBuildFixture } from "./probe-build.fixture.js";
import { SocketFolderFixture } from "./socket-folder.fixture.js";
import { WaitFixture } from "./wait.fixture.js";

export class CliFixture implements AsyncDisposable {
  public static readonly CHECKOUT_VARIABLE: string = "NOLDOVA_DESKTOP_CHECKOUT";
  public static readonly DATA_DIRECTORY_VARIABLE: string = "NOLDOVA_DESKTOP_DATA_DIR";
  private static readonly DATA_DIRECTORY_FLAG: string = "--data-dir";
  private static readonly LOCAL_DATA_VARIABLE: string = "LOCALAPPDATA";
  private static readonly STATE_VARIABLE: string = "XDG_STATE_HOME";
  private static readonly STOP_LIMIT: number = 15_000;
  private static readonly CLEANUP_GRACE: number = 500;

  private readonly folder: SocketFolderFixture;
  private readonly hosts: RuntimeHost[] = [];
  private readonly cleanupGraceMilliseconds: number;

  public readonly root: string;
  public readonly dataDirectory: string;
  public readonly homeFolder: string;
  public readonly entryPath: string;
  public readonly declarationsFile: string;
  public readonly opener: FakeMainProcessOpenerFixture = new FakeMainProcessOpenerFixture();
  public readonly signals: EventEmitter = new EventEmitter();

  private constructor(folder: SocketFolderFixture, cleanupGraceMilliseconds: number) {
    this.folder = folder;
    this.cleanupGraceMilliseconds = cleanupGraceMilliseconds;
    this.root = folder.path;
    this.dataDirectory = path.join(folder.path, "data");
    this.homeFolder = path.join(folder.path, "home");
    this.entryPath = path.join(folder.path, "build", "node_modules", "@noldova", "desktop.runtime", "services", "runtime-entry.mjs");
    this.declarationsFile = ModuleDeclarationReader.locate(this.entryPath);
  }

  public static async createAsync(cleanupGraceMilliseconds: number = CliFixture.CLEANUP_GRACE): Promise<CliFixture> {
    const fixture = new CliFixture(await SocketFolderFixture.createAsync("nol-cli-"), cleanupGraceMilliseconds);
    await mkdir(path.dirname(fixture.entryPath), { recursive: true });
    await writeFile(fixture.entryPath, [
      `import { RuntimeEntry } from "${pathToFileURL(RuntimeEntry.entryPath).href}";`,
      "void RuntimeEntry.settleAsync(RuntimeEntry.runAsync(process.argv.slice(2), process.platform, process.env, process, process.stderr), process.stderr, process);"
    ].join("\n"));
    await mkdir(path.dirname(fixture.declarationsFile), { recursive: true });
    await fixture.writeDeclarationsAsync([]);
    return fixture;
  }

  public get environment(): NodeJS.ProcessEnv {
    const environment = { ...process.env };
    delete environment[CliFixture.CHECKOUT_VARIABLE];
    delete environment[CliFixture.DATA_DIRECTORY_VARIABLE];
    environment[CliFixture.LOCAL_DATA_VARIABLE] = path.join(this.root, "local");
    environment[CliFixture.STATE_VARIABLE] = path.join(this.root, "state");
    return environment;
  }

  public async runAsync(
    commandLineArguments: readonly string[],
    build: Pick<ProbeBuildFixture, "identity" | "entryPath"> | null = null,
    environment: NodeJS.ProcessEnv = this.environment,
    input: string | Readable = String.empty,
    starter?: IProcessStarter,
    updateWaitMilliseconds?: number,
    entryPath: string = build?.entryPath ?? this.entryPath): Promise<{ code: number; output: string; error: string; readLaterError: () => string }> {
    const output = new PassThrough({ encoding: "utf8" });
    const error = new PassThrough({ encoding: "utf8" });
    const inputStream = Object.isString(input) ? new PassThrough({ encoding: "utf8" }).end(input) : input;
    const identity: BuildIdentity = build?.identity ?? RuntimeBuild.identity;
    const context = new CliContext(environment, process.platform, this.homeFolder, process.execPath, entryPath, identity,
      output, error, inputStream, this.signals, starter, this.opener, process.pid, updateWaitMilliseconds,
      this.cleanupGraceMilliseconds);
    const code = await new Cli(context).runAsync(commandLineArguments);
    return { code, output: String(output.read() ?? String.empty), error: String(error.read() ?? String.empty), readLaterError: () => String(error.read() ?? String.empty) };
  }

  public runModuleAsync(
    build: ProbeBuildFixture, commandLineArguments: readonly string[], input: string | Readable = String.empty): Promise<{ code: number; output: string; error: string; readLaterError: () => string }> {
    return this.runAsync([CliFixture.DATA_DIRECTORY_FLAG, this.dataDirectory, ...commandLineArguments], null, this.environment, input, undefined, undefined, build.entryPath);
  }

  public async writeDeclarationsAsync(modules: readonly unknown[], formatVersion: unknown = 2): Promise<void> {
    await writeFile(this.declarationsFile, JSON.stringify({ formatVersion, modules }));
  }

  public get deviceFolder(): string {
    return DeviceFolder.locate(process.platform, this.environment, this.homeFolder);
  }

  public withDataDirectory(commandLineArguments: readonly string[]): string[] {
    return [...commandLineArguments, "--data-dir", this.dataDirectory];
  }

  public async startHostAsync(declarationsFile: string, installationFolder: string | null = null): Promise<RuntimeHost> {
    const options = new RuntimeOptions(new DataDirectory(this.dataDirectory), 30_000, new ServerSettings(), declarationsFile, null, undefined, installationFolder);
    const host = await RuntimeHost.startAsync(options, process.platform, process.env, ProcessPresence.create(process.platform));
    this.hosts.push(host);
    return host;
  }

  public async readRuntimeProcessIdAsync(): Promise<number | null> {
    return (await DiscoveryReader.readAsync(new DataDirectory(this.dataDirectory)))?.processId ?? null;
  }

  public async stopRuntimeAsync(): Promise<void> {
    const processId = await this.readRuntimeProcessIdAsync();
    if (Object.isNull(processId) || processId === process.pid)
      return;
    try {
      process.kill(processId);
    }
    catch {
      return;
    }
    await WaitFixture.untilAsync(() => !OwnershipLock.isOwned(new DataDirectory(this.dataDirectory)), CliFixture.STOP_LIMIT);
  }

  public async [Symbol.asyncDispose](): Promise<void> {
    for (const host of this.hosts) {
      host.requestStop("test");
      await host.waitForStopAsync().catch(() => undefined);
    }
    await this.stopRuntimeAsync();
    await this.folder[Symbol.asyncDispose]();
  }
}
