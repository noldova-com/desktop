/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { expect } from "@playwright/test";

import { WorkNotReportedException } from "../exceptions/work-not-reported.exception.ts";
import { CliFixture } from "./cli.fixture.ts";
import { CommandSearchFixture } from "./command-search.fixture.ts";
import type { MainProcessFixture } from "./main-process.fixture.ts";

export class ClockWorkFixture {
  public static readonly WORK: string = "Counting the ticks";
  public static readonly TIMEOUT: number = 20_000;
  public static readonly INTERVAL: number = 500;

  public static async beginAsync(mainProcess: MainProcessFixture): Promise<void> {
    const window = mainProcess.window;
    await CommandSearchFixture.searchAsync(window, "Begin work");
    await expect(window.locator(".nol-search-pane [role=option]").first()).toHaveAttribute("data-item", "desktop.commands/clock.beginWork");
    await window.keyboard.press("Enter");
    await ClockWorkFixture.waitForReportAsync(mainProcess.dataDirectory);
  }

  public static async finishAsync(dataDirectory: string): Promise<void> {
    await CliFixture.runAsync("run", "clock.finishWork", "--data-dir", dataDirectory);
  }

  public static async readAsync(dataDirectory: string): Promise<string[]> {
    return [...JsonReader.parse(await CliFixture.runAsync("status", "--json", "--data-dir", dataDirectory)).readStringArray("work")];
  }

  private static async waitForReportAsync(dataDirectory: string): Promise<void> {
    let reported: string = "no report";
    try {
      await expect.poll(async () => {
        reported = JSON.stringify(await ClockWorkFixture.readAsync(dataDirectory));
        return reported;
      }, { timeout: ClockWorkFixture.TIMEOUT, intervals: [ClockWorkFixture.INTERVAL] }).toBe(JSON.stringify([ClockWorkFixture.WORK]));
    }
    catch (error) {
      const runtimeLog = await ClockWorkFixture.readLogAsync(dataDirectory, "runtime.log");
      const mainProcessLog = await ClockWorkFixture.readLogAsync(dataDirectory, "main.log");
      throw new WorkNotReportedException(
        reported, existsSync(path.join(dataDirectory, "work", "clock")), runtimeLog?.includes("clock: The clock began counting.") ?? false, runtimeLog, mainProcessLog, error);
    }
  }

  private static async readLogAsync(dataDirectory: string, name: string): Promise<string | null> {
    const file = path.join(dataDirectory, "logs", name);
    return existsSync(file) ? await readFile(file, "utf8") : null;
  }
}
