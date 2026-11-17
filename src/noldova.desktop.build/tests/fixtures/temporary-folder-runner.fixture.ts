/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile } from "node:child_process";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";

import "@noldova/context.core";

import type { ProcessResult } from "../../src/models/processes/process-result.js";
import { BuildException } from "../../src/exceptions/build.exception.js";
import { ProcessRunner } from "../../src/services/processes/process-runner.js";

export class TemporaryFolderRunnerFixture extends ProcessRunner {
  public static readonly STALL_LIMIT: number = 28_000;
  private static readonly TEMPORARY_VARIABLES: readonly string[] = ["TMPDIR", "TEMP", "TMP"];
  private static readonly CONFIGURATION_FILES: readonly (readonly [string, string])[] = [["npm_config_userconfig", "user.npmrc"], ["npm_config_globalconfig", "global.npmrc"]];
  private static readonly LOG_LINES: number = 60;
  private static readonly SAMPLE_LINES: number = 120;
  private static readonly TIMING_LENGTH: number = 6000;
  private static readonly SETTLE_LIMIT: number = 3000;
  private static readonly execute = promisify(execFile);

  private readonly folder: string;
  private readonly stallLimit: number | null;

  private constructor(folder: string, stallLimit: number | null) {
    super();
    this.folder = folder;
    this.stallLimit = stallLimit;
  }

  public static async createAsync(folder: string, stallLimit: number | null = null): Promise<TemporaryFolderRunnerFixture> {
    await mkdir(folder, { recursive: true });
    for (const [, file] of TemporaryFolderRunnerFixture.CONFIGURATION_FILES)
      await writeFile(path.join(folder, file), String.empty);
    return new TemporaryFolderRunnerFixture(folder, stallLimit);
  }

  public override async captureAsync(command: string, commandArguments: readonly string[], directory: string, timeout: number, environment?: NodeJS.ProcessEnv): Promise<ProcessResult> {
    const variables = Object.fromEntries([
      ...TemporaryFolderRunnerFixture.TEMPORARY_VARIABLES.map(t => [t, this.folder]),
      ...TemporaryFolderRunnerFixture.CONFIGURATION_FILES.map(([variable, file]) => [variable, path.join(this.folder, file)])
    ]);
    if (Object.isNull(this.stallLimit))
      return await super.captureAsync(command, commandArguments, directory, timeout, { ...environment ?? process.env, ...variables });

    const logs = path.join(this.folder, "npm-logs");
    const running = super.captureAsync(command, commandArguments, directory, timeout,
      { ...environment ?? process.env, ...variables, npm_config_timing: "true", npm_config_logs_dir: logs });
    const watch = new AbortController();
    const result = await Promise.race([running, delay(this.stallLimit, null, { signal: watch.signal })]).finally(() => watch.abort());
    if (!Object.isNull(result))
      return result;
    throw new BuildException(await this.describeStallAsync(command, commandArguments, running, logs, this.stallLimit));
  }

  private async describeStallAsync(command: string, commandArguments: readonly string[], running: Promise<ProcessResult>, logs: string, limit: number): Promise<string> {
    const report = [`${path.basename(command)} ${commandArguments.join(" ")} was still running after ${limit} ms.`];
    const rows = await TemporaryFolderRunnerFixture.listProcessesAsync();
    const child = rows.find(t => t.parent === process.pid && t.command.includes(commandArguments.at(-1) ?? command));
    if (Object.isUndefined(child))
      report.push("Its process was not found among this process's children.");
    else {
      const tree = [child];
      for (const row of tree)
        tree.push(...rows.filter(t => t.parent === row.id));
      report.push("Its processes:", ...tree.map(t => t.line));
      if (process.platform === "darwin")
        report.push(await this.sampleAsync(child.id));
      report.push(await TemporaryFolderRunnerFixture.stopAsync(child.id, running));
    }
    report.push(...await TemporaryFolderRunnerFixture.readLogsAsync(logs));
    return report.join("\n");
  }

  private static async listProcessesAsync(): Promise<readonly { id: number, parent: number, command: string, line: string }[]> {
    if (process.platform === "win32")
      return [];
    try {
      const { stdout } = await TemporaryFolderRunnerFixture.execute("ps", ["-ww", "-A", "-o", "pid=,ppid=,stat=,etime=,command="]);
      return stdout.split("\n").map(t => t.trim()).filter(t => t.length > 0).map(t => {
        const [id, parent, , , ...command] = t.split(/\s+/);
        return { id: Number(id), parent: Number(parent), command: command.join(" "), line: t };
      });
    }
    catch (error) {
      return [{ id: -1, parent: -1, command: String.empty, line: `ps failed: ${String(error)}` }];
    }
  }

  private async sampleAsync(id: number): Promise<string> {
    const file = path.join(this.folder, `sample-${id}.txt`);
    try {
      await TemporaryFolderRunnerFixture.execute("/usr/bin/sample", [String(id), "2", "-mayDie", "-file", file]);
      const lines = (await readFile(file, "utf8")).split("\n");
      const start = Math.max(0, lines.findIndex(t => t.startsWith("Call graph:")));
      return ["Its sample:", ...lines.slice(start, start + TemporaryFolderRunnerFixture.SAMPLE_LINES)].join("\n");
    }
    catch (error) {
      return `sample failed: ${String(error)}`;
    }
  }

  private static async stopAsync(id: number, running: Promise<ProcessResult>): Promise<string> {
    const settled = running.then(() => true, () => true);
    if (!TemporaryFolderRunnerFixture.signal(id, "SIGTERM")) {
      await settled;
      return "It had ended before SIGTERM.";
    }
    const watch = new AbortController();
    const ended = await Promise.race([settled, delay(TemporaryFolderRunnerFixture.SETTLE_LIMIT, false, { signal: watch.signal })]).finally(() => watch.abort());
    if (ended)
      return "It ended at SIGTERM.";
    TemporaryFolderRunnerFixture.signal(id, "SIGKILL");
    await settled;
    return `It outlived SIGTERM by ${TemporaryFolderRunnerFixture.SETTLE_LIMIT} ms and ended at SIGKILL.`;
  }

  private static signal(id: number, signal: NodeJS.Signals): boolean {
    try {
      return process.kill(id, signal);
    }
    catch {
      return false;
    }
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
