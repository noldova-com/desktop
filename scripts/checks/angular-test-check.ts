/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Writable } from "node:stream";

import "@noldova/context.core";

import { AngularTestProject } from "../angular/angular-test-project.ts";
import { BuildException } from "../../src/noldova.desktop.build/src/exceptions/build.exception.ts";
import { Resources } from "../resources.ts";
import { TotalsException } from "../totals/totals.exception.ts";
import { CheckSelection } from "./check-selection.ts";
import type { FlakyRecord } from "./flaky-record.ts";
import { FlakyTest } from "./flaky-test.ts";
import type { ISelectableCheck } from "./interfaces/i-selectable-check.ts";

export class AngularTestCheck implements ISelectableCheck {
  private readonly project: AngularTestProject;
  private readonly flaky: FlakyRecord | null;

  public readonly title: string = Resources.angularTestCheckTitle;

  public constructor(project: AngularTestProject, flaky: FlakyRecord | null) {
    this.project = project;
    this.flaky = flaky;
  }

  public async runAsync(output: Writable): Promise<boolean> {
    const isPassing = await this.checkAsync(output);
    if (!isPassing)
      output.write(Resources.angularTestLogHint);
    return isPassing;
  }

  public async runSelectedAsync(filters: readonly string[], output: Writable): Promise<CheckSelection> {
    try {
      const specs = await this.project.specFilesAsync();
      const selected = specs.filter(t => filters.some(u => t.includes(u)));
      if (selected.length === 0)
        return new CheckSelection(true, Resources.angularTestUnit, specs.length, 0);
      const isPassing = await this.checkAsync(output, selected);
      if (!isPassing)
        output.write(Resources.angularTestLogHint);
      return new CheckSelection(isPassing, Resources.angularTestUnit, specs.length, selected.length);
    }
    catch (error) {
      if (!(error instanceof BuildException))
        throw error;
      output.write(`${error.message}${Resources.lineEnd}${Resources.angularTestLogHint}`);
      return new CheckSelection(false, Resources.angularTestUnit, 0, 0);
    }
  }

  private async checkAsync(output: Writable, include: readonly string[] = []): Promise<boolean> {
    try {
      const run = await this.project.testAsync(include, !Object.isNull(this.flaky));
      await this.flaky?.addAsync(run.retried.map(t => new FlakyTest(Resources.angularTestTotalsTitle, t.file, t.name, t.failure)), output);
      if (Object.isNull(run.result)) {
        output.write(run.isSuccessful ? Resources.angularTestNoReport : Resources.formatAngularTestEnded(run.exitCode));
        return false;
      }
      const totals = run.result.toTotals(Resources.angularTestRunner, Resources.angularTestTotalsTitle, run.coverage, include.length === 0 ? await this.project.specFilesAsync() : include, null);
      const recorded = include.length === 0 ? await totals.recordAsync(this.project.root, output) : totals.report(output);
      return recorded && run.isSuccessful;
    }
    catch (error) {
      if (!(error instanceof BuildException || error instanceof TotalsException))
        throw error;
      output.write(`${error.message}${Resources.lineEnd}`);
      return false;
    }
  }
}
