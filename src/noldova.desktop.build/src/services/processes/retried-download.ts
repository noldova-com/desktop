/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";
import timers from "node:timers/promises";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import type { ProcessResult } from "../../models/processes/process-result.ts";
import { Resources } from "../../resources.ts";

export class RetriedDownload {
  public static describeInstall(subject: string, result: ProcessResult): string | null {
    if (result.isSuccessful)
      return null;
    const failure = Resources.formatExitCodeProblem(result.exitCode, result.errorOutput);
    if (!Resources.downloadTransientPattern.test(result.text))
      throw new BuildException(Resources.formatDownloadNotRetried(subject, failure));
    return failure;
  }


  public static async runAsync(subject: string, output: Writable, attemptAsync: () => Promise<string | null>,
    pause: number = Resources.downloadRetryPause): Promise<void> {
    let failure = String.empty;
    for (let attempt = 1; attempt <= Resources.downloadAttempts; attempt++) {
      const reason = await attemptAsync();
      if (Object.isNull(reason))
        return;
      failure = reason;
      if (attempt < Resources.downloadAttempts) {
        output.write(Resources.formatDownloadRetry(subject, attempt));
        await timers.setTimeout(pause);
      }
    }
    throw new BuildException(Resources.formatDownloadGaveUp(subject, failure));
  }
}
