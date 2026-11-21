/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { Resources } from "../../src/resources.js";
import { ReleaseCommandLine } from "../../src/services/release-command-line.js";
import { PausedClockFixture } from "../fixtures/paused-clock.fixture.js";
import { ProgramRunFixture } from "../fixtures/program-run.fixture.js";

@TestClass
export class ReleaseCommandLineTests {
  @TestMethod
  public async printsTheUsageWithoutACommandOrForAnUnknownOneAsync(): Promise<void> {
    for (const commandArguments of [[], ["frobnicate"]]) {
      const result = await ReleaseCommandLineTests.runAsync(commandArguments);

      Assert.areEqual(2, result.exitCode);
      Assert.areEqual(Resources.releaseUsage, result.errors);
      Assert.areEqual(String.empty, result.output);
    }
  }

  @TestMethod
  public async namesItsOwnBinInEachCommandsUsageAsync(): Promise<void> {
    const commands = ["list-targets", "release-check", "choose-feed", "release-publish", "release-lock", "release-unlock", "feed-check", "module-range", "noldova-desktop-range"];
    const results: string[] = [];

    for (const command of commands) {
      const result = await ReleaseCommandLineTests.runAsync([command, "extra", "more"]);
      results.push(`${result.exitCode} ${result.output.includes(`noldova-desktop-release ${command}`)}`);
    }

    Assert.areEqual(JSON.stringify(commands.map(() => "2 true")), JSON.stringify(results));
  }

  @TestMethod
  public async checksTheFeedWithTheClockAsync(): Promise<void> {
    const server = createServer();
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = Object.isNull(address) || Object.isString(address) ? 0 : address.port;
    await new Promise<void>(resolve => server.close(() => resolve()));

    const result = await ReleaseCommandLineTests.runAsync(["feed-check"],
      { FEED_URL: `http://127.0.0.1:${port}/`, FEED_VERSION: "1.2.3", RELEASE_TARGETS: "windows-x64", FEED_WAIT_SECONDS: "0" });

    Assert.areEqual(1, result.exitCode);
    Assert.isTrue(result.output.startsWith(`latest-windows-x64.yml could not be read from http://127.0.0.1:${port}/: `), result.output);
  }

  @TestMethod
  public async pausesWithTheClockForAFeedThatIsBehindAsync(): Promise<void> {
    const server = createServer((_, response) => {
      response.statusCode = 404;
      response.end();
    });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    const port = Object.isNull(address) || Object.isString(address) ? 0 : address.port;
    try {
      const result = await PausedClockFixture.withoutPausesAsync(() => ReleaseCommandLineTests.runAsync(["feed-check"],
        { FEED_URL: `http://127.0.0.1:${port}/`, FEED_VERSION: "1.2.3", RELEASE_TARGETS: "windows-x64", FEED_WAIT_SECONDS: "1" }), 10);

      const lines = result.output.split("\n").filter(t => t.length > 0);
      const problem = `latest-windows-x64.yml could not be read from http://127.0.0.1:${port}/: `;
      Assert.areEqual(1, result.exitCode);
      Assert.areEqual(`${problem}HTTP 404. The feed may still be catching up, so the check tries again.`, lines.at(0), result.output);
      Assert.isTrue(lines.length > 1, result.output);
      Assert.isTrue(lines.at(-1)?.startsWith(problem) === true && !lines.at(-1)?.endsWith("so the check tries again."), result.output);
    }
    finally {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }

  @TestMethod
  public async runsAsAProgramWithTheProcessArgumentsAsync(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-release-command-line-"));
    try {
      const run = await ProgramRunFixture.runAsync(import.meta.resolve("../../src/services/release-command-line.js"), ["frobnicate"], folder);

      Assert.areEqual(2, run.exitCode);
      Assert.areEqual(Resources.releaseUsage, run.output);
    }
    finally {
      await rm(folder, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
    }
  }

  private static async runAsync(commandArguments: readonly string[], environment: NodeJS.ProcessEnv = {}): Promise<{ readonly exitCode: number; readonly output: string; readonly errors: string }> {
    const output = new PassThrough();
    const errors = new PassThrough();
    const exitCode = await new ReleaseCommandLine(tmpdir(), environment, output, errors).runAsync(commandArguments);
    return { exitCode, output: output.read(output.readableLength)?.toString() ?? String.empty, errors: errors.read(errors.readableLength)?.toString() ?? String.empty };
  }
}
