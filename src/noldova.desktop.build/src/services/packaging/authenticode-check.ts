/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";

import type { ProcessRunner } from "../processes/process-runner.ts";
import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class AuthenticodeCheck {
  private readonly runner: ProcessRunner;
  private readonly folder: string;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(runner: ProcessRunner, folder: string, environment: NodeJS.ProcessEnv) {
    this.runner = runner;
    this.folder = folder;
    this.environment = environment;
  }

  public async verifyAsync(files: readonly string[], libraries: readonly string[], publisher: string): Promise<string> {
    const checked = [...files, ...libraries];
    const command = Buffer.from(Resources.authenticodeScript, Resources.powershellScriptEncoding).toString(Resources.powershellCommandEncoding);
    const result = await this.runner.captureAsync(Resources.powershellCommand, [...Resources.powershellOptions, command], this.folder, Resources.authenticodeTimeout,
      {
        ...this.environment,
        [Resources.authenticodeFilesVariable]: checked.join(Resources.lineSeparator),
        [Resources.authenticodePublisherVariable]: publisher,
        [Resources.authenticodeVendorsVariable]: [...Resources.authenticodeOrganizations.keys()].join(Resources.lineSeparator)
      });
    if (!result.isSuccessful)
      throw new BuildException(Resources.formatAuthenticodeReadFailed(result.exitCode, result.text));
    const lines = result.output.split(Resources.lineBreakPattern).filter(t => t.length > 0);
    const fields = lines.map(t => t.split(Resources.authenticodeFieldSeparator));
    if (fields.length !== checked.length || fields.some((t, i) => t.length !== Resources.authenticodeReportFieldCount || t[0] !== checked[i]))
      throw new BuildException(Resources.formatAuthenticodeReportIncomplete(checked.length));
    const report = fields.map(([file = String.empty, status = String.empty, timestamped = String.empty, organization = String.empty]) => {
      const signer = Resources.authenticodeOrganizations.get(organization) ?? organization;
      const vendors = !libraries.includes(file) ? [] : path.extname(file).toLowerCase() === Resources.windowsProgramExtension
        ? Resources.authenticodeProgramVendors : Resources.authenticodeLibraryVendors;
      const isAccepted = status === Resources.authenticodeValidStatus && timestamped === Resources.authenticodeTimestamped
        && (signer === Resources.authenticodePublisherSigner || vendors.includes(signer));
      return { isAccepted, line: Resources.formatAuthenticodeLine(file, status, timestamped, AuthenticodeCheck.describe(signer)) };
    });
    const refused = report.filter(t => !t.isAccepted).map(t => Resources.formatAuthenticodeRefusedLine(t.line));
    if (refused.length > 0)
      throw new BuildException(Resources.formatAuthenticodeRefused(refused));
    return report.map(t => t.line).join(Resources.lineSeparator);
  }

  private static describe(signer: string): string {
    switch (signer) {
      case Resources.authenticodePublisherSigner:
        return Resources.authenticodePublisherLabel;
      case Resources.authenticodeOtherSigner:
        return Resources.authenticodeOtherSignerLabel;
      case Resources.authenticodeNoSigner:
        return Resources.authenticodeNoSignerLabel;
      default:
        return signer;
    }
  }
}
