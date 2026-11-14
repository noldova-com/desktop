/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { ProductIdentity } from "../../models/packages/product-identity.ts";
import { ProcessRunner } from "../processes/process-runner.ts";
import { ReleaseFileSet } from "../release/release-file-set.ts";
import { ReleaseNotes } from "../release/release-notes.ts";
import { ReleasePublisher } from "../release/release-publisher.ts";
import { ReleaseReports } from "../release/release-reports.ts";
import { ReleaseTargets } from "../release/release-targets.ts";
import { ReleaseRequest } from "../../models/release/release-request.ts";
import { ReleaseSigning } from "../release/release-signing.ts";
import { Resources } from "../../resources.ts";
import { SupportedTargets } from "../release/supported-targets.ts";
import { GitHubApi } from "../repository/github-api.ts";

export class ReleasePublish {
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly environment: NodeJS.ProcessEnv;
  private readonly output: Writable;
  private readonly command: string;

  public constructor(root: string, runner: ProcessRunner, environment: NodeJS.ProcessEnv, output: Writable, command: string = Resources.commandName) {
    this.root = root;
    this.runner = runner;
    this.environment = environment;
    this.output = output;
    this.command = command;
  }

  public async runAsync(publishArguments: readonly string[]): Promise<number> {
    if (publishArguments.length > 0) {
      this.output.write(Resources.formatReleasePublishUsage(this.command));
      return Resources.usageExitCode;
    }
    try {
      await this.publishAsync();
      return 0;
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      this.output.write(Resources.formatOutputLine(error.message));
      return Resources.failureExitCode;
    }
  }

  private async publishAsync(): Promise<void> {
    const feed = this.environment[Resources.releaseUpdateFeedVariable] ?? String.empty;
    if (feed.length > 0) {
      this.output.write(Resources.formatTestFeedPublishesNothing(feed));
      return;
    }
    const request = ReleaseRequest.read(this.environment);
    const folder = this.environment[Resources.releaseFolderVariable] ?? String.empty;
    if (!path.isAbsolute(folder))
      throw new BuildException(Resources.formatReleaseFolderNotAbsolute(folder));
    if (folder.includes(Resources.uploadLabelMark))
      throw new BuildException(Resources.formatReleaseFolderHasLabelMark(folder));
    const reports = this.environment[Resources.releaseReportsVariable] ?? String.empty;
    if (!path.isAbsolute(reports))
      throw new BuildException(Resources.formatReleaseReportsNotAbsolute(reports));
    const product = await ProductIdentity.readAsync(this.root);
    const signed = (await ReleaseSigning.readAsync(this.root)).listSignedPlatforms(product, request.repository);
    const internal = this.environment[Resources.releaseInternalVariable] ?? String.empty;
    if (internal.length > 0)
      ReleasePublish.requireInternal(internal, request, signed);
    const supported = await SupportedTargets.readAsync(this.root);
    const targets = ReleaseTargets.read(this.environment, supported);
    const notes = ReleaseNotes.compose(product, targets, supported ?? [], signed, request.repository, request.version, this.environment[Resources.releaseRunVariable] ?? String.empty);
    this.output.write(Resources.formatOutputLine(await new ReleaseReports(signed, targets).verifyAsync(reports)));
    const files = await new ReleaseFileSet(product.name, targets).verifyAsync(folder, internal.length > 0 ? internal : request.version.text);
    if (internal.length > 0) {
      this.output.write(Resources.formatInternalFilesChecked(internal));
      return;
    }
    await new ReleasePublisher(new GitHubApi(request.repository, this.runner, this.root), this.output).publishAsync(request.version, request.revision, folder, files, notes);
  }

  private static requireInternal(internal: string, request: ReleaseRequest, signed: readonly string[]): void {
    const base = Resources.releaseInternalPattern.exec(internal)?.[1];
    if (base !== request.version.text)
      throw new BuildException(Resources.formatInternalVersionInvalid(request.version.text, internal));
    if (signed.length === 0)
      throw new BuildException(Resources.formatInternalUnsigned(request.repository));
  }
}
