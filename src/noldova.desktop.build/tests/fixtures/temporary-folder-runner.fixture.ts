/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, execFile, spawn } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import "@noldova/context.core";

import { ProcessResult } from "../../src/models/processes/process-result.js";
import { BuildException } from "../../src/exceptions/build.exception.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";

export class TemporaryFolderRunnerFixture extends ProcessRunner {
  private static readonly TEST_LIMIT: number = 40_000;
  private static readonly REPORT_TIME: number = 17_000;
  private static readonly TEMPORARY_VARIABLES: readonly string[] = ["TMPDIR", "TEMP", "TMP"];
  private static readonly CONFIGURATION_FILES: readonly (readonly [string, string])[] = [["npm_config_userconfig", "user.npmrc"], ["npm_config_globalconfig", "global.npmrc"]];
  private static readonly COMPILE_CACHE_OFF: readonly [string, string] = ["NODE_DISABLE_COMPILE_CACHE", "1"];
  private static readonly LOG_LINES: number = 60;
  private static readonly SAMPLE_LINES: number = 120;
  private static readonly TIMING_LENGTH: number = 6000;
  private static readonly LIST_LIMIT: number = 5000;
  private static readonly SAMPLE_LIMIT: number = 6000;
  private static readonly SETTLE_LIMIT: number = 3000;
  private static readonly KILL_LIMIT: number = 1000;
  private static readonly STOP_RESERVE: number = 6000;
  private static readonly WINDOWS_PROCESSES: string = "Get-Process | ForEach-Object { '{0} {1} - {2:HH:mm:ss} {3}' -f $_.Id, $_.Parent.Id, $_.StartTime, $_.Path }";
  private static readonly execute = promisify(execFile);

  private readonly folder: string;
  private readonly end: number | null;
  private readonly listing: readonly [string, readonly string[]] | null;

  private constructor(folder: string, end: number | null, listing: readonly [string, readonly string[]] | null) {
    super();
    this.folder = folder;
    this.end = end;
    this.listing = listing;
  }

  public static startTest(): number {
    return performance.now() + TemporaryFolderRunnerFixture.TEST_LIMIT;
  }

  public static stallAfter(milliseconds: number): number {
    return performance.now() + TemporaryFolderRunnerFixture.REPORT_TIME + milliseconds;
  }

  public static async createAsync(folder: string, end: number | null = null, listing: readonly [string, readonly string[]] | null = null): Promise<TemporaryFolderRunnerFixture> {
    await mkdir(folder, { recursive: true });
    for (const [, file] of TemporaryFolderRunnerFixture.CONFIGURATION_FILES)
      await writeFile(path.join(folder, file), String.empty);
    return new TemporaryFolderRunnerFixture(folder, end, listing);
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    const variables = Object.fromEntries([
      ...TemporaryFolderRunnerFixture.TEMPORARY_VARIABLES.map(t => [t, this.folder]),
      ...TemporaryFolderRunnerFixture.CONFIGURATION_FILES.map(([variable, file]) => [variable, path.join(this.folder, file)]),
      TemporaryFolderRunnerFixture.COMPILE_CACHE_OFF
    ]);
    if (Object.isNull(this.end))
      return await super.captureAsync(command, commandArguments, directory, timeout, { ...environment ?? process.env, ...variables });

    const logs = path.join(this.folder, "npm-logs");
    const child = spawn(command, [...commandArguments], { cwd: directory, shell: false, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, timeout,
      env: { ...environment ?? process.env, ...variables, npm_config_timing: "true", npm_config_logs_dir: logs } });
    const output: Buffer[] = [];
    const errorOutput: Buffer[] = [];
    child.stdout.on("data", (t: Buffer) => output.push(t));
    child.stderr.on("data", (t: Buffer) => errorOutput.push(t));
    const exited = new Promise<boolean>(resolve => child.once("exit", () => resolve(true)));
    const running = new Promise<ProcessResult>((resolve, reject) => {
      child.once("error", reject);
      child.once("close", t => resolve(new ProcessResult(t, Buffer.concat(output).toString("utf8"), Buffer.concat(errorOutput).toString("utf8"))));
    });
    const stall = Math.max(0, this.end - TemporaryFolderRunnerFixture.REPORT_TIME - performance.now());
    if (await TemporaryFolderRunnerFixture.withinAsync(running.then(() => true, () => true), stall))
      return await running;
    throw new BuildException(await this.describeStallAsync(command, commandArguments, child, exited, logs, stall));
  }

  private async describeStallAsync(command: string, commandArguments: readonly string[], child: ChildProcess, exited: Promise<boolean>, logs: string,
    stall: number): Promise<string> {
    const report = [`${path.basename(command)} ${commandArguments.join(" ")} was still running after ${Math.round(stall)} ms.`];
    try {
      const id = child.pid ?? -1;
      const rows = await this.listProcessesAsync();
      const tree = rows.filter(t => t.id === id);
      for (const row of tree)
        tree.push(...rows.filter(t => t.parent === row.id));
      report.push(...tree.length === 0
        ? [`Its process, ${id}, was not found in the listing.`, ...rows.filter(t => Number.isNaN(t.id)).map(t => t.line)]
        : ["Its processes:", ...tree.map(t => t.line)]);
      if (process.platform === "darwin")
        report.push(await this.sampleAsync(id));
    }
    finally {
      report.push(await TemporaryFolderRunnerFixture.stopAsync(child, exited));
    }
    report.push(...await TemporaryFolderRunnerFixture.readLogsAsync(logs));
    return report.join("\n");
  }

  private left(): number {
    return Object.isNull(this.end) ? 0 : Math.floor(this.end - performance.now() - TemporaryFolderRunnerFixture.STOP_RESERVE);
  }

  private async listProcessesAsync(): Promise<readonly { id: number, parent: number, line: string }[]> {
    const limit = Math.min(process.platform === "win32" ? TemporaryFolderRunnerFixture.LIST_LIMIT + TemporaryFolderRunnerFixture.SAMPLE_LIMIT : TemporaryFolderRunnerFixture.LIST_LIMIT, this.left());
    if (limit <= 0)
      return [{ id: Number.NaN, parent: Number.NaN, line: "The listing was skipped: no time was left." }];
    try {
      const { stdout } = !Object.isNull(this.listing)
        ? await TemporaryFolderRunnerFixture.execute(this.listing[0], [...this.listing[1]], { timeout: limit })
        : process.platform === "win32"
        ? await TemporaryFolderRunnerFixture.execute("pwsh.exe", ["-NoProfile", "-NonInteractive", "-Command", TemporaryFolderRunnerFixture.WINDOWS_PROCESSES], { timeout: limit })
        : await TemporaryFolderRunnerFixture.execute("ps", ["-ww", "-A", "-o", "pid=,ppid=,stat=,etime=,command="], { timeout: limit });
      return stdout.split("\n").map(t => t.trim()).filter(t => t.length > 0).map(t => {
        const [row, parent] = t.split(/\s+/);
        return { id: Number(row), parent: Number(parent), line: t };
      });
    }
    catch (error) {
      return [{ id: Number.NaN, parent: Number.NaN, line: `The listing failed: ${String(error)}` }];
    }
  }

  private async sampleAsync(id: number): Promise<string> {
    const limit = Math.min(TemporaryFolderRunnerFixture.SAMPLE_LIMIT, this.left());
    if (limit <= 0)
      return "The sample was skipped: no time was left.";
    const file = path.join(this.folder, `sample-${id}.txt`);
    try {
      await TemporaryFolderRunnerFixture.execute("/usr/bin/sample", [String(id), "1", "-mayDie", "-file", file], { timeout: limit });
      const lines = (await readFile(file, "utf8")).split("\n");
      const start = Math.max(0, lines.findIndex(t => t.startsWith("Call graph:")));
      return ["Its sample:", ...lines.slice(start, start + TemporaryFolderRunnerFixture.SAMPLE_LINES)].join("\n");
    }
    catch (error) {
      return `The sample failed: ${String(error)}`;
    }
  }

  private static async stopAsync(child: ChildProcess, exited: Promise<boolean>): Promise<string> {
    if (!Object.isNull(child.exitCode) || !Object.isNull(child.signalCode))
      return "It had ended before SIGTERM.";
    child.kill("SIGTERM");
    if (await TemporaryFolderRunnerFixture.withinAsync(exited, TemporaryFolderRunnerFixture.SETTLE_LIMIT))
      return "It ended at SIGTERM.";
    child.kill("SIGKILL");
    if (await TemporaryFolderRunnerFixture.withinAsync(exited, TemporaryFolderRunnerFixture.KILL_LIMIT))
      return `It outlived SIGTERM by ${TemporaryFolderRunnerFixture.SETTLE_LIMIT} ms and ended at SIGKILL.`;
    return `It outlived SIGKILL by ${TemporaryFolderRunnerFixture.KILL_LIMIT} ms.`;
  }

  private static async withinAsync(settled: Promise<boolean>, milliseconds: number): Promise<boolean> {
    const watch = new AbortController();
    return await Promise.race([settled, delay(milliseconds, false, { signal: watch.signal })]).finally(() => watch.abort());
  }

  private static async readLogsAsync(logs: string): Promise<readonly string[]> {
    const files = await readdir(logs).catch(() => []);
    if (files.length === 0)
      return [`npm wrote no log in ${logs}.`];
    const report: string[] = [];
    for (const file of files.sort()) {
      const text = await readFile(path.join(logs, file), "utf8");
      report.push(file.endsWith("timing.json")
        ? `${file}:\n${text.slice(0, TemporaryFolderRunnerFixture.TIMING_LENGTH)}`
        : `${file}, its last lines:\n${text.trimEnd().split("\n").slice(-TemporaryFolderRunnerFixture.LOG_LINES).join("\n")}`);
    }
    return report;
  }
}
