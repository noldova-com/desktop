/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { execFile, spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import "@noldova/context.core";

import { ErrorCodeFixture } from "./error-code.fixture.ts";
import { type IProcessTreeRow, ProcessTree } from "./process-tree.ts";
import { WaitFixture } from "./wait.fixture.ts";

export class ProcessListFixture {
  private static readonly TIMEOUT: number = 30_000;
  private static readonly EXIT_INTERVAL: number = 250;
  private static readonly COMMAND_LINE_TIMEOUT: number = 10_000;
  private static readonly THREADS_TIMEOUT: number = 15_000;
  private static readonly SAMPLE_SECONDS: string = "3";
  private static readonly SAMPLE_PREFIX: string = "desktop-sample-";
  private static readonly SAMPLE_FILE: string = "sample.txt";
  private static readonly SIGNAL_INTERVAL: number = 50;
  private static readonly WINDOWS_ROW: RegExp = /^"([^"]*)","(\d+)"/;
  private static readonly POSIX_ROW: RegExp = /^\s*(\d+)\s+(.+)$/;
  private static readonly ID_ROW: RegExp = /^\s*(\d+)\s*$/;
  private static readonly DESCRIBED_ROW: RegExp = /^\s*(\d+)\s+(.*?)\s*$/;
  private static readonly ID_PAIR_ROW: RegExp = /^\s*(\d+)\s+(\d+)\s*$/;
  private static readonly START_TIME_ENVIRONMENT: Readonly<Record<string, string>> = { LC_ALL: "C", TZ: "UTC" };
  private static readonly START_TIME_ZONE: string = " UTC";
  private static readonly TREE_ROW: RegExp = /^\s*(\d+)\s+(\d+)\s+(\d+|-)\s*$/;
  private static readonly UNKNOWN_CREATION: string = "-";
  private static readonly PROCESS_FOLDER: string = "/proc";
  private static readonly STATUS_FILE: string = "stat";
  private static readonly STATUS_NAME_END: string = ") ";
  private static readonly STATUS_SEPARATOR: string = " ";
  private static readonly STATUS_FIRST_FIELD_AFTER_NAME: number = 3;
  private static readonly STATUS_START_FIELD: number = 22;
  private static readonly ENDED_PROCESS_ERRORS: readonly string[] = ["ENOENT", "ESRCH"];
  private static readonly PROCESSOR_TIME: RegExp = /^\s*(?:(?:(\d+)-)?(\d+):)?(\d+):(\d+(?:\.\d+)?)\s*$/m;

  public static readNames(processIds: readonly number[]): ReadonlyMap<number, string> {
    const isWindows = process.platform === "win32";
    const result = isWindows
      ? spawnSync("tasklist", ["/FO", "CSV", "/NH"], { encoding: "utf8", windowsHide: true, timeout: ProcessListFixture.TIMEOUT })
      : spawnSync("ps", ["-o", "pid=,comm=", "-p", processIds.join(",")], { encoding: "utf8", timeout: ProcessListFixture.TIMEOUT });
    if (!Object.isUndefined(result.error))
      throw result.error;
    const pattern = isWindows ? ProcessListFixture.WINDOWS_ROW : ProcessListFixture.POSIX_ROW;
    const names = new Map<number, string>();
    for (const line of result.stdout.split(/\r?\n/)) {
      const match = pattern.exec(line);
      if (Object.isNull(match))
        continue;
      const [processId, name] = isWindows ? [Number(match[2]), match[1]] : [Number(match[1]), match[2]];
      if (processIds.includes(processId) && !Object.isUndefined(name))
        names.set(processId, name.trim());
    }
    return names;
  }

  public static async readRunningAsync(processIds: readonly number[]): Promise<number[]> {
    if (processIds.length === 0)
      return [];
    const output = process.platform === "win32"
      ? await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Microsoft.PowerShell.Management\\Get-Process -Id ${processIds.join(",")} -ErrorAction SilentlyContinue | Microsoft.PowerShell.Core\\ForEach-Object { $_.Id }`])
      : await ProcessListFixture.runAsync("ps", ["-o", "pid=", "-p", processIds.join(",")]);
    const listed = output.split(/\r?\n/).map(t => ProcessListFixture.ID_ROW.exec(t)).filter(t => !Object.isNull(t)).map(t => Number(t[1]));
    return processIds.filter(t => listed.includes(t));
  }

  public static async waitForExitAsync(processIds: readonly number[], limit: number, onWaiting: (running: readonly number[]) => void = () => undefined): Promise<number[]> {
    let running = [...processIds];
    await WaitFixture.holdsWithinAsync(async () => {
      running = await ProcessListFixture.readRunningAsync(running);
      if (running.length > 0)
        onWaiting(running);
      return running.length === 0;
    }, limit, ProcessListFixture.EXIT_INTERVAL);
    return running;
  }

  public static async waitForSignalsAsync(processIds: readonly number[], limit: number): Promise<number[]> {
    let answering = [...processIds];
    await WaitFixture.holdsWithinAsync(() => {
      answering = answering.filter(t => ProcessListFixture.answersSignal(t));
      return answering.length === 0;
    }, limit, ProcessListFixture.SIGNAL_INTERVAL);
    return answering;
  }

  public static async describeAsync(processIds: readonly number[]): Promise<string> {
    const output = process.platform === "win32"
      ? await ProcessListFixture.describeOnWindowsAsync(processIds)
      : await ProcessListFixture.runAsync("ps", ["-ww", "-o", "pid=,args=", "-p", processIds.join(",")]);
    const described = new Map(output.split(/\r?\n/).map(t => ProcessListFixture.DESCRIBED_ROW.exec(t)).filter(t => !Object.isNull(t)).map(t => [Number(t[1]), t[2] ?? String.empty]));
    return processIds.map(t => `${t} ${described.get(t) ?? "(gone)"}`).join("; ");
  }

  public static async describeNamingAsync(text: string): Promise<string> {
    const naming = [...await ProcessListFixture.readCommandLinesAsync()].filter(([, line]) => line.includes(text)).map(([processId, line]) => `${processId} ${line}`);
    return naming.length === 0 ? "none" : naming.join("; ");
  }

  public static async readCommandLinesAsync(): Promise<ReadonlyMap<number, string>> {
    const output = process.platform === "win32"
      ? await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        "Microsoft.PowerShell.Management\\Get-WmiObject -Query 'SELECT ProcessId, CommandLine FROM Win32_Process' | Microsoft.PowerShell.Core\\ForEach-Object { \"$($_.ProcessId) $($_.CommandLine)\" }"], ProcessListFixture.COMMAND_LINE_TIMEOUT)
      : await ProcessListFixture.runAsync("ps", ["-ww", "-A", "-o", "pid=,args="]);
    return new Map(output.split(/\r?\n/).map(t => ProcessListFixture.DESCRIBED_ROW.exec(t)).filter(t => !Object.isNull(t)).map(t => [Number(t[1]), t[2] ?? String.empty]));
  }

  public static async readStartTimesAsync(processIds: readonly number[]): Promise<ReadonlyMap<number, number>> {
    if (processIds.length === 0)
      return new Map();
    if (process.platform === "linux")
      return await ProcessListFixture.readStartTicksAsync(processIds);
    if (process.platform === "win32") {
      const output = await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Microsoft.PowerShell.Management\\Get-Process -Id ${processIds.join(",")} -ErrorAction SilentlyContinue | Microsoft.PowerShell.Core\\ForEach-Object { "$($_.Id) $(([DateTimeOffset]$_.StartTime).ToUnixTimeMilliseconds())" }`]);
      return new Map(output.split(/\r?\n/).map(t => ProcessListFixture.ID_PAIR_ROW.exec(t)).filter(t => !Object.isNull(t)).map(t => [Number(t[1]), Number(t[2])]));
    }
    const output = await ProcessListFixture.runAsync("ps", ["-o", "pid=,lstart=", "-p", processIds.join(",")], ProcessListFixture.TIMEOUT,
      { ...process.env, ...ProcessListFixture.START_TIME_ENVIRONMENT });
    const startTimes = new Map<number, number>();
    for (const row of output.split(/\r?\n/).map(t => ProcessListFixture.DESCRIBED_ROW.exec(t)).filter(t => !Object.isNull(t))) {
      const started = Date.parse(`${row[2] ?? String.empty}${ProcessListFixture.START_TIME_ZONE}`);
      if (Number.isNaN(started))
        throw new Error(`ps gave process ${row[1] ?? String.empty} the start time "${row[2] ?? String.empty}", which is not a date.`);
      startTimes.set(Number(row[1]), started);
    }
    return startTimes;
  }

  public static readStartTicks(status: string): number {
    const nameEnd = status.lastIndexOf(ProcessListFixture.STATUS_NAME_END);
    const fields = status.slice(nameEnd + ProcessListFixture.STATUS_NAME_END.length).split(ProcessListFixture.STATUS_SEPARATOR);
    const ticks = Number(fields[ProcessListFixture.STATUS_START_FIELD - ProcessListFixture.STATUS_FIRST_FIELD_AFTER_NAME]);
    if (nameEnd < 0 || !Number.isSafeInteger(ticks))
      throw new Error(`The process status "${status.trim()}" has no start time in field ${ProcessListFixture.STATUS_START_FIELD}.`);
    return ticks;
  }

  public static async readTreeAsync(): Promise<IProcessTreeRow[]> {
    const rows = process.platform === "win32"
      ? (await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        "Microsoft.PowerShell.Management\\Get-WmiObject -Query 'SELECT ProcessId, ParentProcessId, CreationDate FROM Win32_Process' | Microsoft.PowerShell.Core\\ForEach-Object { " +
        "\"$($_.ProcessId) $($_.ParentProcessId) $(if ($_.CreationDate) { ([DateTimeOffset][Management.ManagementDateTimeConverter]::ToDateTime($_.CreationDate)).ToUnixTimeMilliseconds() } else { '-' })\" }"],
        ProcessListFixture.COMMAND_LINE_TIMEOUT)).split(/\r?\n/)
      : (await ProcessListFixture.runAsync("ps", ["-A", "-o", "pid=,ppid="])).split(/\r?\n/).map(t => `${t} ${ProcessListFixture.UNKNOWN_CREATION}`);
    return rows.map(t => ProcessListFixture.TREE_ROW.exec(t)).filter(t => !Object.isNull(t)).map(t => ({
      processId: Number(t[1]),
      parentId: Number(t[2]),
      created: t[3] === ProcessListFixture.UNKNOWN_CREATION ? null : Number(t[3])
    }));
  }

  public static async readDescendantsAsync(processId: number): Promise<number[]> {
    return new ProcessTree(await ProcessListFixture.readTreeAsync()).listDescendants(processId);
  }

  public static async readProcessorMillisecondsAsync(processId: number): Promise<number | null> {
    if (process.platform === "win32") {
      const output = await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Microsoft.PowerShell.Management\\Get-Process -Id ${processId} -ErrorAction SilentlyContinue | Microsoft.PowerShell.Core\\ForEach-Object { [long]$_.TotalProcessorTime.TotalMilliseconds }`]);
      const row = ProcessListFixture.ID_ROW.exec(output);
      return Object.isNull(row) ? null : Number(row[1]);
    }
    const time = ProcessListFixture.PROCESSOR_TIME.exec(await ProcessListFixture.runAsync("ps", ["-o", "time=", "-p", String(processId)]));
    if (Object.isNull(time))
      return null;
    const [days, hours, minutes, seconds] = time.slice(1).map(t => Number(t ?? 0));
    return Math.round(((((days ?? 0) * 24 + (hours ?? 0)) * 60 + (minutes ?? 0)) * 60 + (seconds ?? 0)) * 1000);
  }

  public static async describeThreadsAsync(processId: number): Promise<string> {
    if (process.platform === "win32")
      return await ProcessListFixture.runReportingAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Microsoft.PowerShell.Management\\Get-Process -Id ${processId} -ErrorAction SilentlyContinue | Microsoft.PowerShell.Core\\ForEach-Object { $_.Threads } | ` +
        "Microsoft.PowerShell.Core\\ForEach-Object { \"$($_.Id) $($_.ThreadState) $(if ($_.ThreadState -eq 'Wait') { $_.WaitReason } else { '-' }) $([long]$_.TotalProcessorTime.TotalMilliseconds) ms\" }"]);
    if (process.platform !== "darwin")
      return await ProcessListFixture.runReportingAsync("ps", ["-L", "-o", "tid=,stat=,wchan:32=,time=,comm=", "-p", String(processId)]);
    const folder = await mkdtemp(path.join(os.tmpdir(), ProcessListFixture.SAMPLE_PREFIX));
    try {
      const file = path.join(folder, ProcessListFixture.SAMPLE_FILE);
      const output = await ProcessListFixture.runReportingAsync("sample", [String(processId), ProcessListFixture.SAMPLE_SECONDS, "-file", file]);
      return await readFile(file, "utf8").catch(() => output);
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  private static answersSignal(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch (error) {
      return ErrorCodeFixture.of(error) === "EPERM";
    }
  }

  private static async readStartTicksAsync(processIds: readonly number[]): Promise<ReadonlyMap<number, number>> {
    const startTicks = new Map<number, number>();
    for (const processId of processIds) {
      const status = await readFile(path.posix.join(ProcessListFixture.PROCESS_FOLDER, String(processId), ProcessListFixture.STATUS_FILE), "utf8").catch((error: unknown) => {
        if (ProcessListFixture.ENDED_PROCESS_ERRORS.includes(ErrorCodeFixture.of(error) ?? String.empty))
          return null;
        throw error;
      });
      if (!Object.isNull(status))
        startTicks.set(processId, ProcessListFixture.readStartTicks(status));
    }
    return startTicks;
  }

  private static async runReportingAsync(file: string, commandArguments: readonly string[]): Promise<string> {
    try {
      const result = await promisify(execFile)(file, [...commandArguments], { encoding: "utf8", windowsHide: true, timeout: ProcessListFixture.THREADS_TIMEOUT, maxBuffer: 16 * 1024 * 1024 });
      return `${result.stdout}${result.stderr}`;
    }
    catch (error) {
      const stopped = ErrorCodeFixture.wasKilled(error) ? `\nIt was stopped after ${ProcessListFixture.THREADS_TIMEOUT} ms.` : String.empty;
      return `${ErrorCodeFixture.messageOf(error)}${stopped}\n${ErrorCodeFixture.stdoutOf(error) ?? String.empty}`;
    }
  }

  private static async describeOnWindowsAsync(processIds: readonly number[]): Promise<string> {
    try {
      return await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Microsoft.PowerShell.Management\\Get-WmiObject -Query "SELECT ProcessId, CommandLine FROM Win32_Process WHERE ${processIds.map(t => `ProcessId = ${t}`).join(" OR ")}" |Microsoft.PowerShell.Core\\ForEach-Object { "$($_.ProcessId) $($_.CommandLine)" }`],
        ProcessListFixture.COMMAND_LINE_TIMEOUT);
    }
    catch {
      return await ProcessListFixture.runAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
        `Microsoft.PowerShell.Management\\Get-Process -Id ${processIds.join(",")} -ErrorAction SilentlyContinue | Microsoft.PowerShell.Core\\ForEach-Object { "$($_.Id) $($_.Path)" }`]);
    }
  }

  private static async runAsync(
    file: string,
    commandArguments: readonly string[],
    timeout: number = ProcessListFixture.TIMEOUT,
    environment: NodeJS.ProcessEnv = process.env): Promise<string> {
    try {
      return (await promisify(execFile)(file, [...commandArguments], { encoding: "utf8", windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024, env: environment })).stdout;
    }
    catch (error) {
      const output = ErrorCodeFixture.stdoutOf(error);
      if (Object.isNumber(ErrorCodeFixture.codeOf(error)) && !Object.isUndefined(output))
        return output;
      throw error;
    }
  }
}
