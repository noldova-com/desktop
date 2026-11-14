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
import { Resources } from "../../resources.ts";

export class RetriedDownload {

  public static async runAsync(subject: string, output: Writable, attemptAsync: () => Promise<string | null>): Promise<void> {
    let failure = String.empty;
    for (let attempt = 1; attempt <= Resources.downloadAttempts; attempt++) {
      const reason = await attemptAsync();
      if (Object.isNull(reason))
        return;
      failure = reason;
      if (attempt < Resources.downloadAttempts) {
        output.write(Resources.formatDownloadRetry(subject, attempt));
        await timers.setTimeout(Resources.downloadRetryPause);
      }
    }
    throw new BuildException(Resources.formatDownloadGaveUp(subject, failure));
  }
}
