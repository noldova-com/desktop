/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { Resources } from "../resources.ts";
import type { ICheck } from "./interfaces/i-check.ts";
import { UpdateTestRunCheckResources } from "./update-test-run-check.resources.ts";

export class UpdateTestRunCheck implements ICheck {
  private readonly root: string;

  public readonly title: string = UpdateTestRunCheckResources.title;

  public constructor(root: string) {
    this.root = root;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const findings = [...await this.checkPublishAsync(), ...await this.checkBuildAsync(), ...await this.checkPackageAsync()];
    for (const finding of findings)
      output.write(UpdateTestRunCheckResources.formatRuledFinding(finding));
    output.write(UpdateTestRunCheckResources.checkedLine);
    return findings.length === 0;
  }

  private async checkPublishAsync(): Promise<readonly string[]> {
    const job = UpdateTestRunCheck.readJob(await this.readLinesAsync(UpdateTestRunCheckResources.releaseWorkflow), UpdateTestRunCheckResources.publishJob);
    if (job.length === 0)
      return [UpdateTestRunCheckResources.formatNoJob(UpdateTestRunCheckResources.releaseWorkflow, UpdateTestRunCheckResources.publishJob)];
    const findings: string[] = [];
    const condition = job.map(t => UpdateTestRunCheckResources.publishCondition.exec(t)).find(t => !Object.isNull(t));
    if (Object.isUndefined(condition) || UpdateTestRunCheck.hasTopLevelOr(condition[1] ?? String.empty))
      findings.push(UpdateTestRunCheckResources.unguardedPublish);
    if (!UpdateTestRunCheck.readStep(job, UpdateTestRunCheckResources.publishStep).some(t => t.trim() === UpdateTestRunCheckResources.publishGuard))
      findings.push(UpdateTestRunCheckResources.unpassedGuard);
    return findings;
  }

  private async checkBuildAsync(): Promise<readonly string[]> {
    const lines = await this.readLinesAsync(UpdateTestRunCheckResources.releaseWorkflow);
    return UpdateTestRunCheckResources.buildJobs.filter(t => !UpdateTestRunCheck.readJob(lines, t).some(u => u.trim() === UpdateTestRunCheckResources.keepInput))
      .map(t => UpdateTestRunCheckResources.formatUnkeptInput(t));
  }

  private async checkPackageAsync(): Promise<readonly string[]> {
    const job = UpdateTestRunCheck.readJob(await this.readLinesAsync(UpdateTestRunCheckResources.packageWorkflow), UpdateTestRunCheckResources.packageJob);
    if (job.length === 0)
      return [UpdateTestRunCheckResources.formatNoJob(UpdateTestRunCheckResources.packageWorkflow, UpdateTestRunCheckResources.packageJob)];
    const findings: string[] = [];
    for (const line of job.filter(t => UpdateTestRunCheckResources.condition.test(t) && UpdateTestRunCheckResources.feedNames.test(t)))
      findings.push(UpdateTestRunCheckResources.formatFeedCondition(line.trim()));
    const assets = UpdateTestRunCheck.readStep(job, UpdateTestRunCheckResources.assetsStep);
    if (assets.length === 0 || assets.some(t => UpdateTestRunCheckResources.condition.test(t))
      || !assets.some(t => t.trim() === UpdateTestRunCheckResources.assetsFeed) || !assets.some(t => t.trim() === UpdateTestRunCheckResources.assetsCommand))
      findings.push(UpdateTestRunCheckResources.unwrittenAssets);
    const keep = UpdateTestRunCheck.readStep(job, UpdateTestRunCheckResources.keepStep);
    const missing = UpdateTestRunCheckResources.keptFiles.filter(t => !keep.some(u => u.trim().endsWith(t)));
    if (keep.length === 0 || keep.some(t => UpdateTestRunCheckResources.condition.test(t) && t.trim() !== UpdateTestRunCheckResources.keepCondition) || missing.length > 0 || !keep.some(t => t.trim() === UpdateTestRunCheckResources.noFilesFail))
      findings.push(UpdateTestRunCheckResources.formatUnkeptFiles(missing));
    return findings;
  }

  private async readLinesAsync(file: string): Promise<readonly string[]> {
    return (await readFile(path.join(this.root, file), Resources.encoding)).split(UpdateTestRunCheckResources.lineSeparator);
  }

  private static readJob(lines: readonly string[], name: string): readonly string[] {
    const start = lines.indexOf(UpdateTestRunCheckResources.formatJobStart(name));
    if (start < 0)
      return [];
    const end = lines.findIndex((t, i) => i > start && t.length > 0 && !t.startsWith(UpdateTestRunCheckResources.jobBodyStart));
    return lines.slice(start + 1, end < 0 ? lines.length : end);
  }

  private static readStep(job: readonly string[], name: string): readonly string[] {
    const start = job.findIndex(t => UpdateTestRunCheckResources.stepStart.exec(t)?.[2] === name);
    if (start < 0)
      return [];
    const indent = UpdateTestRunCheckResources.stepStart.exec(job[start] ?? String.empty)?.[1] ?? String.empty;
    const end = job.findIndex((t, i) => i > start && t.trim().length > 0 && !t.startsWith(`${indent}${Resources.indent}`));
    return job.slice(start + 1, end < 0 ? job.length : end);
  }

  private static hasTopLevelOr(expression: string): boolean {
    let depth = 0;
    for (let i = 0; i < expression.length; i++) {
      if (expression[i] === UpdateTestRunCheckResources.openParenthesis)
        depth++;
      else if (expression[i] === UpdateTestRunCheckResources.closeParenthesis)
        depth--;
      else if (depth === 0 && expression.startsWith(UpdateTestRunCheckResources.topLevelOr, i))
        return true;
    }
    return false;
  }
}
