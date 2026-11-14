/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import timers from "node:timers/promises";

import type { ProcessResult } from "../../models/processes/process-result.ts";
import type { ProcessRunner } from "../processes/process-runner.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class AppleSignatureCheck {
  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, folder: string, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.folder = folder;
    this.environment = environment;
  }

  public async verifyAsync(packages: readonly string[], productName: string): Promise<string> {
    await rm(this.folder, { recursive: true, force: true });
    await mkdir(this.folder, { recursive: true });
    const lines: string[] = [];
    try {
      for (const [index, file] of packages.entries()) {
        const work = path.join(this.folder, String(index));
        await mkdir(work);
        lines.push(path.extname(file) === Resources.diskImageExtension
          ? await this.checkDiskImageAsync(file, work, productName)
          : await this.checkArchiveAsync(file, work, productName));
      }
    }
    finally {
      await rm(this.folder, { recursive: true, force: true });
    }
    return lines.join(Resources.lineSeparator);
  }

  public static async runStaplerAsync(run: () => Promise<ProcessResult>): Promise<ProcessResult> {
    for (let attempt = 1; ; attempt++) {
      const stapled = await run();
      if (!AppleSignatureCheck.isNetworkError(stapled) || attempt === Resources.staplerAttempts)
        return stapled;
      await timers.setTimeout(Resources.staplerPause);
    }
  }

  public static isNetworkError(result: ProcessResult): boolean {
    return !result.isSuccessful && Resources.appleNetworkErrorPattern.test(result.text);
  }

  private async checkDiskImageAsync(image: string, mount: string, productName: string): Promise<string> {
    await this.requireSignedAsync(Resources.formatAppleDiskImageSubject(image), image, false, Resources.spctlDiskImageAssessment);
    await this.runner.requireAsync(Resources.hdiutilCommand, [...Resources.hdiutilAttachArguments, mount, image], this.folder, Resources.appleSignatureTimeout,
      this.environment);
    try {
      await this.requireSignedAsync(Resources.formatAppleAppSubject(image), path.join(mount, `${productName}${Resources.appBundleExtension}`), true,
        Resources.spctlAppAssessment);
      return Resources.formatAppleDiskImageVerified(image);
    }
    finally {
      await this.runner.requireAsync(Resources.hdiutilCommand, [Resources.hdiutilDetachArgument, mount, Resources.hdiutilForceOption], this.folder,
        Resources.appleSignatureTimeout, this.environment);
    }
  }

  private async checkArchiveAsync(archive: string, folder: string, productName: string): Promise<string> {
    await this.runner.requireAsync(Resources.dittoCommand, [...Resources.dittoExtractArguments, archive, folder], this.folder, Resources.appleSignatureTimeout,
      this.environment);
    await this.requireSignedAsync(Resources.formatAppleAppSubject(archive), path.join(folder, `${productName}${Resources.appBundleExtension}`), true,
      Resources.spctlAppAssessment);
    return Resources.formatAppleArchiveVerified(archive);
  }

  private async requireSignedAsync(subject: string, file: string, isBundle: boolean, assessment: readonly string[]): Promise<void> {
    const verified = await this.captureAsync(Resources.codesignCommand, [Resources.codesignVerifyOption, ...(isBundle ? [Resources.codesignDeepOption] : []),
      Resources.codesignStrictOption, Resources.appleVerboseOption, file]);
    const details = await this.captureAsync(Resources.codesignCommand, [Resources.codesignDisplayOption, Resources.appleVerboseOption, file]);
    const assessed = await this.captureAsync(Resources.spctlCommand, [Resources.spctlAssessOption, ...assessment, Resources.appleVerboseOption, file]);
    const stapled = await this.validateStapleAsync(file);
    const requirements: readonly (readonly [string, boolean])[] = [
      [Resources.appleValidSignatureRequirement, verified.isSuccessful],
      [Resources.appleDeveloperIdRequirement, details.isSuccessful && Resources.appleDeveloperIdPattern.test(details.text)],
      [Resources.appleNotarizationRequirement, assessed.isSuccessful && Resources.appleNotarizedPattern.test(assessed.text)],
      [!AppleSignatureCheck.isNetworkError(stapled) ? Resources.appleStapledRequirement : Resources.appleStapledOfflineRequirement, stapled.isSuccessful]
    ];
    const failed = requirements.filter(([, isMet]) => !isMet).map(([requirement]) => requirement);
    if (failed.length > 0)
      throw new BuildException(Resources.formatAppleSignatureLacks(subject, failed, [verified, details, assessed, stapled].map(t => t.text)));
  }

  private validateStapleAsync(file: string): Promise<ProcessResult> {
    return AppleSignatureCheck.runStaplerAsync(() => this.captureAsync(Resources.xcrunCommand, [...Resources.staplerValidateArguments, file]));
  }

  private captureAsync(command: string, commandArguments: readonly string[]): Promise<ProcessResult> {
    return this.runner.captureAsync(command, commandArguments, this.folder, Resources.appleSignatureTimeout, this.environment);
  }
}
