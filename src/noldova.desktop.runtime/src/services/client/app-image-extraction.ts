/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { open } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";

import { AppImageCopyUnavailableException } from "../../exceptions/app-image-copy-unavailable.exception.js";
import { Resources } from "../../resources.js";

export class AppImageExtraction {
  public static async extractAsync(image: string, extraction: string, environment: NodeJS.ProcessEnv, startLog: string): Promise<string> {
    const errors = await open(startLog, Resources.appendFlag, Resources.privateFileMode);
    let isExtracted: boolean;
    try {
      isExtracted = await AppImageExtraction.runAsync(image, extraction, environment, errors.fd);
    }
    catch (error) {
      throw new AppImageCopyUnavailableException(image, new ExceptionOptions(error));
    }
    finally {
      await errors.close();
    }
    if (!isExtracted)
      throw new AppImageCopyUnavailableException(image);
    return path.join(extraction, Resources.copyExtractionFolder);
  }

  private static async runAsync(image: string, extraction: string, environment: NodeJS.ProcessEnv, errors: number): Promise<boolean> {
    const child = spawn(image, [Resources.appImageExtractOption], { cwd: extraction, env: environment, stdio: [Resources.ignoredOutput, Resources.ignoredOutput, errors] });
    const [exitCode]: unknown[] = await once(child, Resources.exitEvent);
    return exitCode === 0;
  }
}
