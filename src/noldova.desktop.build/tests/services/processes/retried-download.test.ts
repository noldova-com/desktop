/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { PassThrough } from "node:stream";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ProcessResult } from "../../../src/models/processes/process-result.js";
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

  @TestMethod
  @TestData("TypeError: fetch failed")
  @TestData("Error: Response code 503 (Service Unavailable) for https://example.com/electron.zip")
  @TestData("Download failed: server closed connection. URL: https://example.com/chromium.zip")
  @TestData("Download failed: server returned code 502 body ''. URL: https://example.com/chromium.zip")
  @TestData("Error: read ECONNRESET")
  @TestData("Error: connect ETIMEDOUT 192.0.2.1:443")
  public givesAnInstallThatFailedOnTheNetworkAnotherTry(text: string): void {
    Assert.areEqual(Resources.formatExitCodeProblem(1, text), RetriedDownload.describeInstall("Chromium", new ProcessResult(1, String.empty, text)));
  }

  @TestMethod
  @TestData("Error: Response code 404 (Not Found) for https://example.com/electron.zip")
  @TestData("Download failed: server returned code 404 body 'Not Found'. URL: https://example.com/chromium.zip")
  @TestData("Error: ENOSPC: no space left on device, write")
  @TestData("Error: EACCES: permission denied, mkdir '/opt/cache'")
  public failsAnInstallAtOnceWhenItsFailureIsNotANetworkOne(text: string): void {
    const error = Assert.throws(() => RetriedDownload.describeInstall("Chromium", new ProcessResult(1, String.empty, text)), BuildException);

    Assert.areEqual(Resources.formatDownloadNotRetried("Chromium", Resources.formatExitCodeProblem(1, text)), error.message);
  }

  @TestMethod
  public describesNothingForAnInstallThatSucceeded(): void {
    Assert.isNull(RetriedDownload.describeInstall("Chromium", new ProcessResult(0, "done", "Response code 404")));
  }

  private static read(output: PassThrough): string {
    return output.read(output.readableLength)?.toString() ?? String.empty;
  }
}
