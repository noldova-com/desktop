/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";

import "@noldova/context.core";
import { Assert } from "@noldova/context.testing";
import {
  type IPosixProcessTableApi, type IWindowsProcessApi, type OwnedProcess, PosixProcessApi, ProcessClock, ProcessSettings, ProcessSupervisor, type PseudoTerminal, WindowsProcessApi
} from "@noldova/desktop.runtime";

import { ProcessClockFixture } from "./process-clock.fixture.js";
import { ProgramFixture } from "./program.fixture.js";
import type { SettingsFixture } from "./settings.fixture.js";
import { WaitFixture } from "./wait.fixture.js";

export class ProcessSupervisorFixture {
  public static readonly MODULE: string = "notes";
  public static readonly RECORDS: string = "SELECT module, program, process_id FROM owned_processes";
  public static readonly INSERT: string =
    "INSERT INTO owned_processes (module, process_id, program, executable, boot, requested, started, seen, clock_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
  public static readonly SEEN: string = "SELECT started, seen FROM owned_processes";
  public static readonly HOUR: number = 3_600_000;
  public static readonly SYSTEM_ROOT: string = process.env["SystemRoot"] ?? "C:\\Windows";
  public static readonly LINUX: ProcessClock = new ProcessClockFixture(24 * ProcessSupervisorFixture.HOUR, "boot", true);
  public static readonly WINDOWS: ProcessClock = ProcessClock.create("win32");

  public static readStarted(settings: SettingsFixture): number {
    return Number(settings.database.read("SELECT started FROM owned_processes")?.["started"]);
  }

  public static line(owned: OwnedProcess | PseudoTerminal, text: string): string {
    return `The module notes's program ${owned.program} (process ${owned.processId}): ${text}\n`;
  }

  public static endsTheTree(text: string, owned: OwnedProcess | PseudoTerminal, before: string, after: string): boolean {
    const start = ProcessSupervisorFixture.line(owned, `${before} `).slice(0, -1);
    const end = ` ${after}\n`;
    if (!text.startsWith(start) || !text.endsWith(end))
      return false;
    const ended = text.slice(start.length, -end.length).split(", ");
    return ended.includes(String(owned.processId)) && ended.every(t => /^[1-9]\d*$/.test(t));
  }

  public static async waitForAsync(condition: () => boolean, describe: () => string = () => String.empty, milliseconds: number = 5_000): Promise<void> {
    const held = await WaitFixture.untilAsync(condition, milliseconds);
    Assert.isTrue(held, held ? String.empty : `The condition did not hold within ${milliseconds / 1_000} seconds.${describe().length === 0 ? String.empty : ` ${describe()}`}`);
  }

  public static async changedAsync(processes: ProcessSupervisor, condition: () => boolean): Promise<void> {
    const held = Promise.withResolvers<void>();
    const registration = processes.onChanged(() => {
      if (condition())
        held.resolve();
    });
    if (condition())
      held.resolve();
    try {
      await held.promise;
    }
    finally {
      registration[Symbol.dispose]();
    }
  }

  public static async printedAsync(terminal: PseudoTerminal, output: () => string, expected: string | RegExp): Promise<void> {
    const isPrinted = (): boolean => Object.isString(expected) ? output().includes(expected) : expected.test(output());
    const printed = Promise.withResolvers<void>();
    const registration = terminal.onOutput(() => {
      if (isPrinted())
        printed.resolve();
    });
    if (isPrinted())
      printed.resolve();
    const exited = terminal.exited.then(t => {
      if (!isPrinted())
        throw new Error(`The program exited with ${t.code} ${t.signal} before it printed ${Object.isString(expected) ? JSON.stringify(expected) : String(expected)}. It printed: ${JSON.stringify(output())}`);
    });
    try {
      await Promise.race([printed.promise, exited]);
    }
    finally {
      registration[Symbol.dispose]();
    }
  }

  public static async spawnAsync(): Promise<ChildProcess> {
    const other = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", detached: process.platform !== "win32", windowsHide: true });
    await once(other, "spawn");
    return other;
  }

  public static async endAsync(other: ChildProcess): Promise<void> {
    const exited = once(other, "exit");
    other.kill("SIGKILL");
    await exited;
  }

  public static createLinux(settings: SettingsFixture, posix: IPosixProcessTableApi, processSettings: ProcessSettings = new ProcessSettings(300, 500)): ProcessSupervisor {
    return ProcessSupervisorFixture.create(settings, "linux", process.env, posix, ProcessSupervisorFixture.LINUX, WindowsProcessApi.create(), processSettings);
  }

  public static createWindows(
    settings: SettingsFixture,
    windows: IWindowsProcessApi,
    posix: IPosixProcessTableApi = PosixProcessApi.create("win32"),
    processSettings: ProcessSettings = new ProcessSettings(300, 500)): ProcessSupervisor {
    return ProcessSupervisorFixture.create(settings, "win32", { SystemRoot: ProcessSupervisorFixture.SYSTEM_ROOT }, posix, ProcessSupervisorFixture.WINDOWS, windows, processSettings);
  }

  public static createWith(settings: SettingsFixture, processSettings: ProcessSettings): ProcessSupervisor {
    return ProcessSupervisorFixture.create(settings, process.platform, process.env, PosixProcessApi.create(process.platform), ProcessClock.create(process.platform),
      WindowsProcessApi.create(), processSettings);
  }

  public static createSeeing(settings: SettingsFixture): ProcessSupervisor {
    return ProcessSupervisor.create(settings.database, process.platform, process.env, settings.diagnostics, new ProcessSettings(300, 500, 20));
  }

  public static create(
    settings: SettingsFixture,
    platform: string = process.platform,
    environment: NodeJS.ProcessEnv = process.env,
    posix: IPosixProcessTableApi = PosixProcessApi.create(platform),
    clock: ProcessClock = ProcessClock.create(process.platform),
    windows: IWindowsProcessApi = WindowsProcessApi.create(),
    processSettings: ProcessSettings = new ProcessSettings(300, 500)): ProcessSupervisor {
    return new ProcessSupervisor(settings.database, platform, environment, posix, settings.diagnostics, windows, processSettings, clock);
  }
}
