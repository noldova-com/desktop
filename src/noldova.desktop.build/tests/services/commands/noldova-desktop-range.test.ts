/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { NoldovaDesktopRange } from "../../../src/services/commands/noldova-desktop-range.js";

@TestClass
export class NoldovaDesktopRangeTests {
  @TestMethod
  public async writesTheRangeFromALowestVersionToTheNextVersionThatMayBreakModulesAsync(): Promise<void> {
    const results = await Promise.all(["0.0.71", "0.9.4", "1.2.3", "10.0.0"].map(t => NoldovaDesktopRangeTests.runAsync([t])));

    Assert.areEqual(">=0.0.71 <0.1.0\n>=0.9.4 <0.10.0\n>=1.2.3 <2.0.0\n>=10.0.0 <11.0.0\n", results.map(t => t.output).join(String.empty));
    Assert.areEqual("0 0 0 0", results.map(t => String(t.exitCode)).join(" "));
  }

  @TestMethod
  public async refusesAnythingButOneExactVersionAsync(): Promise<void> {
    const results = await Promise.all(["^0.0.71", "0.0.71-beta.1", "01.0.0", String.empty].map(t => NoldovaDesktopRangeTests.runAsync([t])));

    Assert.areEqual(
      "::error::\"^0.0.71\" is not one exact version, such as 0.0.71.\n::error::\"0.0.71-beta.1\" is not one exact version, such as 0.0.71.\n"
        + "::error::\"01.0.0\" is not one exact version, such as 0.0.71.\n::error::\"\" is not one exact version, such as 0.0.71.\n",
      results.map(t => t.output).join(String.empty));
    Assert.areEqual("1 1 1 1", results.map(t => String(t.exitCode)).join(" "));
  }

  @TestMethod
  public async answersNoVersionOrMoreThanOneWithItsUsageAsync(): Promise<void> {
    const results = await Promise.all([[], ["0.0.71", "0.0.72"]].map(t => NoldovaDesktopRangeTests.runAsync(t)));

    Assert.areEqual("Usage: noldova-desktop-release noldova-desktop-range <lowest Noldova Desktop version>\n".repeat(2), results.map(t => t.output).join(String.empty));
    Assert.areEqual("2 2", results.map(t => String(t.exitCode)).join(" "));
  }

  private static async runAsync(commandArguments: readonly string[]): Promise<{ readonly exitCode: number; readonly output: string }> {
    const output = new PassThrough();
    const exitCode = await new NoldovaDesktopRange(output, "noldova-desktop-release").runAsync(commandArguments);
    return { exitCode, output: output.read(output.readableLength)?.toString() ?? String.empty };
  }
}
