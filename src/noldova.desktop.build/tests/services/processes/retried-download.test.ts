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

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { Resources } from "../../../src/resources.js";
import { RetriedDownload } from "../../../src/services/processes/retried-download.js";
import { PausedTimersFixture } from "../../fixtures/paused-timers.fixture.js";

@TestClass
export class RetriedDownloadTests {
  @TestMethod
  public async stopsAtTheFirstAttemptThatSucceeds(): Promise<void> {
    const output = new PassThrough();
    const failures = ["timed out", "reset"];

    await PausedTimersFixture.withoutPausesAsync(() => RetriedDownload.runAsync("Chromium", output, () => Promise.resolve(failures.shift() ?? null)), Resources.downloadRetryPause);

    Assert.areEqual(Resources.formatDownloadRetry("Chromium", 1) + Resources.formatDownloadRetry("Chromium", 2), RetriedDownloadTests.read(output));
  }

  @TestMethod
  public async givesUpAfterTheLastAttemptWithItsFailure(): Promise<void> {
    const output = new PassThrough();
    let attempts = 0;

    const error = await Assert.throwsAsync(() => PausedTimersFixture.withoutPausesAsync(() => RetriedDownload.runAsync("Chromium", output, () => {
      attempts++;
      return Promise.resolve(`failure ${attempts}`);
    }), Resources.downloadRetryPause), BuildException);

    Assert.areEqual(Resources.downloadAttempts, attempts);
    Assert.areEqual(Resources.formatDownloadGaveUp("Chromium", `failure ${Resources.downloadAttempts}`), error.message);
    Assert.areEqual(Resources.downloadAttempts - 1, RetriedDownloadTests.read(output).split("trying again").length - 1);
  }

  private static read(output: PassThrough): string {
    return output.read()?.toString() ?? String.empty;
  }
}
