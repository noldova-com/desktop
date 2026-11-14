/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { ProcessResult } from "../../src/models/processes/process-result.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";
import type { StartedProcess } from "../../src/services/processes/started-process.js";
import { SmokeProcessFixture } from "./smoke-process.fixture.js";

export class SmokeRunnerFixture extends ProcessRunner {
  public static readonly MAIN: number = 4141;
  public static readonly RUNTIME: number = 4242;
  public static readonly PATH: string = "C:\\Tools";
  public static readonly PRODUCT_NAME: string = "Sample App";
  public static readonly SLUG: string = "sample-app";

  private static readonly SENTINEL: string = "dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX";
  private static readonly PICKLE_LENGTH: number = 4;
  private static readonly PICKLE_PREFIX: number = 8;
  private static readonly MACH_HEADER: readonly number[] = [0xcf, 0xfa, 0xed, 0xfe, 0x07, 0x00, 0x00, 0x01];

  public readonly captured: string[] = [];
  public readonly environments: NodeJS.ProcessEnv[] = [];
  public readonly started: string[] = [];
  public readonly killed: number[] = [];
  public readonly running: Set<number> = new Set<number>();
  public answer: (name: string, commandArguments: readonly string[], environment: NodeJS.ProcessEnv | undefined) => ProcessResult | null = () => null;
  public main: SmokeProcessFixture | null = null;
  public data: string | null = null;
  public userPath: string | null = SmokeRunnerFixture.PATH;
  public version: string | null = "1.2.3";
  public publisher: string | null = null;
  public window: unknown = { title: SmokeRunnerFixture.PRODUCT_NAME, isVisible: true, isPainted: true };
  public quitOutcome: string = "Quit";
  public isRuntimeUp: boolean = false;
  public startsRuntime: boolean = true;
  public writesProcessId: boolean = true;
  public mainExitCode: number | null = null;
  public quitExitCode: number | null = 0;
  public runtimeEndsWithMain: boolean = true;
  public killStopsRuntime: boolean = true;
  public runningFailure: Error | null = null;
  public isCookieEncrypted: boolean = false;
  public hasFuseWire: boolean = true;
  public addsToPath: boolean = true;
  public uninstallKeepsPath: boolean = false;
  public discoveryIsFolder: boolean = false;
  public debianFolder: string = String.empty;

  public static createArchive(product: string): Buffer {
    const content = Buffer.from(product);
    const json = Buffer.from(JSON.stringify({ files: { _build: { files: { "product.json": { size: content.length, offset: "0" } } } } }));
    const pickle = Buffer.alloc(SmokeRunnerFixture.PICKLE_PREFIX + json.length);
    pickle.writeUInt32LE(SmokeRunnerFixture.PICKLE_LENGTH + json.length, 0);
    pickle.writeUInt32LE(json.length, SmokeRunnerFixture.PICKLE_LENGTH);
    json.copy(pickle, SmokeRunnerFixture.PICKLE_PREFIX);
    const sizes = Buffer.alloc(SmokeRunnerFixture.PICKLE_PREFIX);
    sizes.writeUInt32LE(SmokeRunnerFixture.PICKLE_LENGTH, 0);
    sizes.writeUInt32LE(pickle.length, SmokeRunnerFixture.PICKLE_LENGTH);
    return Buffer.concat([sizes, pickle, content]);
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, _timeout: number, environment?: NodeJS.ProcessEnv):
    Promise<ProcessResult> {
    const name = path.basename(command);
    this.captured.push([name, ...commandArguments].join(" "));
    if (!Object.isUndefined(environment))
      this.environments.push(environment);
    const scripted = this.answer(name, commandArguments, environment);
    if (!Object.isNull(scripted))
      return scripted;
    if (commandArguments.some(t => t === "status" || t.includes(" status ")))
      return this.answerStatus();
    if (commandArguments.includes("quit"))
      return this.quit();
    if (name === "reg.exe")
      return this.answerRegistry(commandArguments);
    if (name === "dpkg-deb")
      return SmokeRunnerFixture.succeed(`${SmokeRunnerFixture.SLUG}\n`);
    if (name === "readlink")
      return SmokeRunnerFixture.succeed(`${path.posix.join(this.debianFolder, SmokeRunnerFixture.SLUG)}\n`);
    if (name === "stat")
      return SmokeRunnerFixture.succeed("0:755\n");
    if (name === "sudo" && commandArguments.includes("apt-get") && commandArguments.includes("install")) {
      const program = path.posix.join(this.debianFolder, SmokeRunnerFixture.SLUG);
      await this.writeAppAsync(program, path.posix.join(this.debianFolder, "resources"), program);
    }
    else if (name === "sudo" && commandArguments.includes("apt-get") && commandArguments.includes("remove"))
      await rm(this.debianFolder, { recursive: true, force: true });
    if (name === `${SmokeRunnerFixture.PRODUCT_NAME}-windows-x64.exe`)
      await this.installWindowsAsync(environment ?? {});
    else if (name.startsWith("Uninstall "))
      await this.uninstallWindowsAsync(commandArguments);
    else if (name === `${SmokeRunnerFixture.PRODUCT_NAME}-linux-x64.AppImage`)
      await this.extractAppImageAsync(directory);
    else if (name === "ditto")
      await this.copyBundleAsync(String(commandArguments[1]));
    return SmokeRunnerFixture.succeed(String.empty);
  }

  public override async startAsync(command: string, commandArguments: readonly string[], _directory: string, log: string): Promise<StartedProcess> {
    this.started.push([path.basename(command), ...commandArguments].join(" "));
    await writeFile(log, "main started\n");
    const option = "--data-dir=";
    const data = commandArguments.find(t => t.startsWith(option))?.slice(option.length) ?? String.empty;
    this.data = data;
    await mkdir(path.join(data, "discovery"), { recursive: true });
    await writeFile(path.join(data, "discovery", "runtime.json"), JSON.stringify(this.writesProcessId ? { processId: SmokeRunnerFixture.RUNTIME } : {}));
    this.isRuntimeUp = this.startsRuntime;
    if (Object.isNull(this.mainExitCode) || !this.runtimeEndsWithMain)
      this.running.add(SmokeRunnerFixture.RUNTIME);
    this.main = new SmokeProcessFixture(SmokeRunnerFixture.MAIN, this.mainExitCode, () => this.endMain());
    return this.main;
  }

  public override isRunning(processId: number): boolean {
    if (!Object.isNull(this.runningFailure))
      throw this.runningFailure;
    return this.running.has(processId);
  }

  public override kill(processId: number): void {
    this.killed.push(processId);
    if (this.killStopsRuntime)
      this.running.delete(processId);
  }

  private static succeed(output: string): ProcessResult {
    return new ProcessResult(0, output, String.empty);
  }

  private static createProgram(isEncrypted: boolean, hasWire: boolean): Buffer {
    const state = isEncrypted ? 0x31 : 0x30;
    return Buffer.concat([Buffer.from("electron-program-"), ...(hasWire ? [Buffer.from(SmokeRunnerFixture.SENTINEL), Buffer.from([1, 2, 0x31, state])] : [])]);
  }

  private endMain(): void {
    if (!this.runtimeEndsWithMain)
      return;
    this.running.delete(SmokeRunnerFixture.RUNTIME);
    this.isRuntimeUp = false;
  }

  private answerStatus(): ProcessResult {
    if (!this.isRuntimeUp)
      return new ProcessResult(3, String.empty, "No runtime is running.");
    return SmokeRunnerFixture.succeed(JSON.stringify({
      ...(Object.isNull(this.version) ? {} : { build: { productVersion: this.version } }),
      dataDirectory: this.data,
      modules: [],
      window: this.window
    }));
  }

  private quit(): ProcessResult {
    if (!Object.isNull(this.quitExitCode))
      this.main?.exit(this.quitExitCode);
    return SmokeRunnerFixture.succeed(JSON.stringify({ outcome: this.quitOutcome }));
  }

  private answerRegistry(commandArguments: readonly string[]): ProcessResult {
    const [action] = commandArguments;
    if (action === "add")
      this.userPath = String(commandArguments[commandArguments.indexOf("/d") + 1]);
    if (action === "delete")
      this.userPath = null;
    if (action !== "query")
      return SmokeRunnerFixture.succeed(String.empty);
    return Object.isNull(this.userPath)
      ? new ProcessResult(1, String.empty, "ERROR: The system was unable to find the specified registry key or value.")
      : SmokeRunnerFixture.succeed(`\r\nHKEY_CURRENT_USER\\Environment\r\n    Path    REG_SZ    ${this.userPath}\r\n\r\n`);
  }

  private async writeAppAsync(program: string, resources: string, fuseBinary: string): Promise<void> {
    await mkdir(path.dirname(program), { recursive: true });
    await mkdir(path.dirname(fuseBinary), { recursive: true });
    await mkdir(resources, { recursive: true });
    await writeFile(fuseBinary, SmokeRunnerFixture.createProgram(this.isCookieEncrypted, this.hasFuseWire));
    if (program !== fuseBinary)
      await writeFile(program, Buffer.from(SmokeRunnerFixture.MACH_HEADER));
    await writeFile(path.join(resources, "app.asar"), SmokeRunnerFixture.createArchive(JSON.stringify({ windowsPublisher: this.publisher })));
  }

  private async installWindowsAsync(environment: NodeJS.ProcessEnv): Promise<void> {
    const folder = path.join(environment["LOCALAPPDATA"] ?? String.empty, "Programs", SmokeRunnerFixture.SLUG);
    const program = path.join(folder, `${SmokeRunnerFixture.PRODUCT_NAME}.exe`);
    await this.writeAppAsync(program, path.join(folder, "resources"), program);
    await mkdir(path.join(folder, "bin"), { recursive: true });
    await writeFile(path.join(folder, "bin", `${SmokeRunnerFixture.SLUG}.cmd`), "@echo off\n");
    await writeFile(path.join(folder, "ffmpeg.dll"), "library");
    await writeFile(path.join(folder, `Uninstall ${SmokeRunnerFixture.PRODUCT_NAME}.exe`), "uninstaller");
    const entry = path.join(folder, "bin");
    const entries = (this.userPath ?? String.empty).split(";").filter(t => t.length > 0);
    if (this.addsToPath && !entries.includes(entry))
      this.userPath = [...entries, entry].join(";");
  }

  private async uninstallWindowsAsync(commandArguments: readonly string[]): Promise<void> {
    const option = "_?=";
    const folder = commandArguments.find(t => t.startsWith(option))?.slice(option.length) ?? String.empty;
    for (const name of await readdir(folder))
      if (!name.startsWith("Uninstall "))
        await rm(path.join(folder, name), { recursive: true, force: true });
    if (!this.uninstallKeepsPath)
      this.userPath = (this.userPath ?? String.empty).split(";").filter(t => t !== path.join(folder, "bin")).join(";");
  }

  private async extractAppImageAsync(folder: string): Promise<void> {
    const extracted = path.join(folder, "squashfs-root");
    const program = path.join(extracted, SmokeRunnerFixture.SLUG);
    await this.writeAppAsync(program, path.join(extracted, "resources"), program);
    if (this.discoveryIsFolder)
      await mkdir(path.join(folder, "data", "discovery", "runtime.json"), { recursive: true });
  }

  private async copyBundleAsync(application: string): Promise<void> {
    const contents = path.join(application, "Contents");
    await this.writeAppAsync(path.join(contents, "MacOS", SmokeRunnerFixture.PRODUCT_NAME), path.join(contents, "Resources"),
      path.join(contents, "Frameworks", "Electron Framework.framework", "Electron Framework"));
  }
}
