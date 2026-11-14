/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type ChildProcessByStdio, spawn } from "node:child_process";
import { once } from "node:events";
import { symlink } from "node:fs/promises";
import { connect } from "node:net";
import path from "node:path";
import type { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

import "@noldova/context.core";
import { type OwnedProcess, ProcessRequest } from "@noldova/desktop.runtime";

import { ProgramEndFixture } from "./program-end.fixture.js";
import { WaitFixture } from "./wait.fixture.js";

export class ProgramFixture {
  public static readonly WAIT: string = "wait";
  public static readonly STUBBORN: string = "stubborn";
  public static readonly EXIT: string = "exit";
  public static readonly PARENT: string = "parent";
  public static readonly CONSOLE_CHILD: string = "console-child";
  public static readonly FOREVER: string = "forever";
  public static readonly ENVIRONMENT: string = "environment";
  public static readonly VARIABLES: string = "variables";
  public static readonly ARGUMENTS: string = "arguments";
  public static readonly READY: string = "ready";
  public static readonly ECHO: string = "echo";
  public static readonly DEAF: string = "deaf";
  public static readonly SIZE: string = "size";
  public static readonly FLOOD: string = "flood";
  public static readonly LONG_LINE: string = "long-line";
  public static readonly LAUNCH: string = "launch";
  public static readonly LAUNCHER: string = "launcher";
  public static readonly LAUNCHED_PATTERN: RegExp = /launched=(\d+) (\d+)/u;
  public static readonly LAUNCH_MILLISECONDS: number = 10_000;
  public static readonly END_MILLISECONDS: number = 6_000;
  public static readonly file: string = fileURLToPath(import.meta.url);

  private static readonly KEPT_PREFIX: string = "NOLDOVA_DESKTOP_";
  private static readonly STARTED_PATTERN: RegExp = /started=(\d+)/gu;

  public static request(workingFolder: string, launchArguments: readonly string[], signal?: AbortSignal, program: string = process.execPath): ProcessRequest {
    return new ProcessRequest(program, [ProgramFixture.file, ...launchArguments], workingFolder, {}, [], signal);
  }

  public static async locateWindowsProgramAsync(folder: string): Promise<string> {
    if (process.platform === "win32")
      return process.execPath;
    const program = path.join(folder, "node.exe");
    await symlink(process.execPath, program);
    return program;
  }

  public static async readLineAsync(owned: OwnedProcess): Promise<string> {
    owned.output.setEncoding("utf8");
    let text = String.empty;
    while (!text.includes("\n")) {
      const [chunk]: unknown[] = await once(owned.output, "data");
      text += String(chunk);
    }
    return text.slice(0, text.indexOf("\n")).trim();
  }

  public static async readAllAsync(owned: OwnedProcess): Promise<string> {
    owned.output.setEncoding("utf8");
    let text = String.empty;
    owned.output.on("data", (t: string) => {
      text += t;
    });
    await owned.exited;
    if (!owned.output.readableEnded)
      await once(owned.output, "end");
    return text.trim();
  }

  public static isRunning(processId: number): boolean {
    try {
      process.kill(processId, 0);
      return true;
    }
    catch {
      return false;
    }
  }

  public static readLaunched(text: string): readonly [number, number] {
    const match = ProgramFixture.LAUNCHED_PATTERN.exec(text);
    return [Number(match?.[1]), Number(match?.[2])];
  }

  public static endIfRunning(processId: number): void {
    if (ProgramFixture.isRunning(processId))
      process.kill(processId);
  }

  public static async endLaunchedAsync(text: string): Promise<void> {
    const launched = [...text.matchAll(ProgramFixture.STARTED_PATTERN)].map(t => Number(t[1]));
    launched.forEach(t => ProgramFixture.endIfRunning(t));
    await Promise.all(launched.map(t => ProgramFixture.waitForEndAsync(t, 3_000)));
  }

  public static async waitForEndAsync(processId: number, milliseconds: number): Promise<boolean> {
    return await WaitFixture.untilAsync(() => !ProgramFixture.isRunning(processId), milliseconds);
  }

  public static run(behavior: string, launchArguments: readonly string[]): void {
    switch (behavior) {
      case ProgramFixture.WAIT:
        ProgramFixture.waitForInputEnd();
        break;
      case ProgramFixture.STUBBORN:
        process.on("SIGTERM", () => undefined);
        setInterval(() => undefined, 1_000);
        process.stdout.write(`${ProgramFixture.READY}\n`);
        break;
      case ProgramFixture.EXIT:
        process.exitCode = Number(launchArguments[0]);
        break;
      case ProgramFixture.PARENT:
        ProgramFixture.startChild(launchArguments[0] ?? ProgramFixture.WAIT);
        break;
      case ProgramFixture.CONSOLE_CHILD:
        ProgramFixture.connectThenReport(launchArguments[0]);
        setInterval(() => undefined, 1_000);
        break;
      case ProgramFixture.FOREVER:
        setInterval(() => undefined, 1_000);
        break;
      case ProgramFixture.ECHO:
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (t: string) => process.stdout.write(t.toUpperCase()));
        ProgramFixture.waitForInputEnd();
        break;
      case ProgramFixture.SIZE:
        process.stdin.setRawMode(true);
        process.stdout.on("resize", () => ProgramFixture.writeSize());
        ProgramFixture.writeSize();
        ProgramFixture.waitForInputEnd();
        break;
      case ProgramFixture.LAUNCH:
        ProgramFixture.launch(launchArguments);
        break;
      case ProgramFixture.FLOOD:
        ProgramFixture.flood(`${"x".repeat(1_023)}\n`);
        break;
      case ProgramFixture.LONG_LINE:
        ProgramFixture.flood("x".repeat(1_024));
        break;
      case ProgramFixture.LAUNCHER:
        ProgramFixture.startApp();
        break;
      case ProgramFixture.DEAF:
        process.on("SIGHUP", () => undefined);
        process.on("SIGTERM", () => undefined);
        setInterval(() => undefined, 1_000);
        process.stdout.write(`${ProgramFixture.READY}\n`);
        break;
      case ProgramFixture.ENVIRONMENT:
        process.stderr.write(`${ProgramFixture.ENVIRONMENT}\n`);
        process.stdout.write(`${JSON.stringify({
          folder: process.cwd(),
          path: process.env["PATH"] ?? null,
          kept: Object.entries(process.env).filter(([t]) => t.startsWith(ProgramFixture.KEPT_PREFIX)).sort(([t], [u]) => t.localeCompare(u))
        })}\n`);
        break;
      case ProgramFixture.VARIABLES:
        process.stdout.write(`${JSON.stringify(launchArguments.map(t => [t, process.env[t] ?? null]))}\n`);
        break;
      default:
        process.stdout.write(`${JSON.stringify(launchArguments)}\n`);
    }
  }

  private static flood(line: string): void {
    let isWritable = true;
    while (isWritable)
      isWritable = process.stdout.write(line);
    process.stdout.once("drain", () => ProgramFixture.flood(line));
  }

  private static writeSize(): void {
    process.stdout.write(`${process.stdout.columns}x${process.stdout.rows}\n`);
  }

  private static waitForInputEnd(): void {
    process.stdin.on("end", () => process.exit(0));
    process.stdin.resume();
    process.stdout.write(`${ProgramFixture.READY}\n`);
  }

  private static connectThenReport(port: string | undefined): void {
    const report = (): void => void process.stdout.write(`${process.pid}\n`);
    if (Object.isUndefined(port))
      report();
    else
      connect(Number(port), ProgramEndFixture.HOST, report).on("error", () => undefined);
  }

  private static launch(endArguments: readonly string[]): void {
    const launcher = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.LAUNCHER], { stdio: ["ignore", "pipe", "ignore"], detached: true });
    const reportAsync = (program: ChildProcessByStdio<null, Readable, null>): Promise<string> => new Promise(resolve => ProgramFixture.readLine(program, t => {
      process.stdout.write(`started=${t}\n`);
      resolve(t);
    }));
    void Promise.all([reportAsync(ProgramFixture.startConsoleChild(endArguments)), reportAsync(launcher), once(launcher, "exit")]).then(([child, app]) => {
      process.stdout.write(`launched=${child} ${app}\n`);
      ProgramFixture.waitForInputEnd();
    });
  }

  private static startConsoleChild(endArguments: readonly string[]): ChildProcessByStdio<null, Readable, null> {
    const extra = endArguments.map(t => ` ${t}`).join(String.empty);
    return process.platform === "win32"
      ? spawn(process.env["ComSpec"] ?? "cmd.exe", [`/d /s /c "start "" /b "${process.execPath}" "${ProgramFixture.file}" ${ProgramFixture.CONSOLE_CHILD}${extra}"`], { stdio: ["ignore", "pipe", "ignore"], windowsVerbatimArguments: true })
      : spawn("/bin/sh", ["-c", `"$0" "$1" ${ProgramFixture.CONSOLE_CHILD}${extra} &`, process.execPath, ProgramFixture.file], { stdio: ["ignore", "pipe", "ignore"] });
  }

  private static readLine(program: ChildProcessByStdio<null, Readable, null>, then: (line: string) => void): void {
    let text = String.empty;
    const read = (t: string): void => {
      text += t;
      if (text.includes("\n")) {
        program.stdout.off("data", read);
        then(text.trim());
      }
    };
    program.stdout.setEncoding("utf8");
    program.stdout.on("data", read);
  }

  private static startApp(): void {
    const app = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", detached: true, windowsHide: true });
    app.unref();
    process.stdout.write(`${app.pid}\n`);
  }

  private static startChild(then: string): void {
    const child = spawn(process.execPath, [ProgramFixture.file, ProgramFixture.FOREVER], { stdio: "ignore", windowsHide: true });
    process.stdout.write(`${child.pid}\n`, () => {
      if (then === ProgramFixture.WAIT)
        ProgramFixture.waitForInputEnd();
      else
        process.exit(Number(then));
    });
  }
}

if (import.meta.main)
  ProgramFixture.run(process.argv[2] ?? ProgramFixture.ARGUMENTS, process.argv.slice(3));
