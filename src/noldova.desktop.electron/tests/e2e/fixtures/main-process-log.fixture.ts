/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";

import "@noldova/context.core";

import { ErrorCodeFixture } from "./error-code.fixture.ts";

export class MainProcessLogFixture {
  private static readonly ENTRY: RegExp = /^\d{4}-\d{2}-\d{2}T\S+ /;
  private static readonly CONTINUATION: string = "    ";
  private static readonly MAIN_PROCESS_FAILURE: RegExp = /^\S+ The main process(?:'s main process failed| could not ask what to do after its main process failed)/;

  public static async describeMainProcessFailuresAsync(file: string, output: readonly string[]): Promise<string> {
    let log: string | null = null;
    let unread: string | null = null;
    try {
      log = await readFile(file, "utf8");
    }
    catch (error) {
      unread = `The main process log could not be read (${ErrorCodeFixture.of(error) ?? "no error code"}), so only its lines on the main process's error output were read.`;
    }
    const logged = Object.isNull(log) ? [] : MainProcessLogFixture.readEntries(log.split("\n"), String.empty).map(t => t.trimEnd());
    const firstLines = new Set(logged.map(t => MainProcessLogFixture.firstLine(t)));
    const written = MainProcessLogFixture.readEntries(output, MainProcessLogFixture.CONTINUATION).filter(t => !firstLines.has(MainProcessLogFixture.firstLine(t)));
    const failures = [...logged, ...written]
      .filter(t => MainProcessLogFixture.MAIN_PROCESS_FAILURE.test(t))
      .sort((a, b) => MainProcessLogFixture.timeOf(a).localeCompare(MainProcessLogFixture.timeOf(b)));
    const description = failures.length === 0
      ? "The main process log shows no main-process failure."
      : `The main process log shows ${failures.length === 1 ? "this main-process failure" : "these main-process failures"}:\n${failures.join("\n")}`;
    return Object.isNull(unread) ? description : `${unread}\n${description}`;
  }

  private static readEntries(lines: readonly string[], continuation: string): string[] {
    const entries: string[] = [];
    for (const line of lines)
      if (MainProcessLogFixture.ENTRY.test(line))
        entries.push(line);
      else if (entries.length > 0)
        entries[entries.length - 1] += `\n${continuation}${line}`;
    return entries;
  }

  private static firstLine(entry: string): string {
    const end = entry.indexOf("\n");
    return end < 0 ? entry : entry.slice(0, end);
  }

  private static timeOf(entry: string): string {
    return entry.slice(0, entry.indexOf(" "));
  }
}
