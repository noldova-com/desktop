/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import { glob, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { ExceptionOptions } from "@noldova/context.exceptions";
import { JsonReader } from "@noldova/context.json";

import { BuildException } from "../../src/noldova.desktop.build/src/exceptions/build.exception.ts";
import { LoggedProcess } from "../checks/logged-process.ts";
import { Resources } from "../resources.ts";
import type { ICoverageCount } from "../totals/interfaces/i-coverage-count.ts";
import { JsonFields } from "../totals/json-fields.ts";
import { AngularTestReport } from "./angular-test-report.ts";
import { AngularTestRun } from "./angular-test-run.ts";
import { RetriedTest } from "./retried-test.ts";

export class AngularTestProject {
  private readonly sources: string;
  private readonly directory: string;

  public readonly root: string;
  public readonly projectFile: string;
  public readonly projectName: string;

  public constructor(root: string) {
    this.root = root;
    this.sources = path.join(root, Resources.sourceFolder);
    this.directory = path.join(this.sources, Resources.angularTestProjectFolder);
    this.projectFile = path.join(this.directory, Resources.typeScriptProjectFile);
    this.projectName = this.describe(this.projectFile);
  }

  public async testAsync(include: readonly string[], isRetrying: boolean): Promise<AngularTestRun> {
    const report = path.join(this.root, ...Resources.angularTestReportSegments);
    const coverage = path.join(this.root, ...Resources.angularTestCoverageSegments, Resources.angularTestCoverageSummaryFile);
    await rm(report, { force: true });
    await rm(path.dirname(coverage), { recursive: true, force: true });
    await rm(path.join(this.root, Resources.angularTestDependencyCache), { recursive: true, force: true });
    await mkdir(path.dirname(report), { recursive: true });
    const exitCode = await LoggedProcess.runAsync(
      process.execPath,
      [path.join(this.root, Resources.angularTestCli), ...Resources.angularTestArguments, Resources.angularTestOutputFileOption, report, ...AngularTestProject.selectionArguments(include.map(t => this.projectPath(t)))],
      this.directory,
      path.join(this.root, Resources.angularTestLogFile),
      process.stdout,
      process.stderr,
      AngularTestProject.environment(isRetrying));
    const results = existsSync(report) ? await this.readResultsAsync(report) : null;
    return new AngularTestRun(
      exitCode,
      Object.isNull(results) ? null : new AngularTestReport(this.describe(report), t => this.specName(path.resolve(t))).read(results),
      existsSync(coverage) ? await this.readCoverageAsync(coverage) : null,
      Object.isNull(results) ? [] : results.flatMap(t => this.readRetried(t)));
  }

  public async specFilesAsync(): Promise<readonly string[]> {
    const workspaceFile = path.join(this.directory, Resources.angularTestWorkspaceFile);
    const workspace = await this.readJsonAsync(workspaceFile);
    const unnamed = Resources.formatAngularTestUnnamed(this.describe(workspaceFile));
    const options = AngularTestProject.readField(unnamed, () => AngularTestProject.findTestOptions(workspace));
    if (Object.isUndefined(options))
      throw new BuildException(unnamed);
    if (options.hasField(Resources.angularTestExcludeField))
      throw new BuildException(Resources.formatAngularTestExcluded(this.describe(workspaceFile)));
    const include = AngularTestProject.readField(unnamed, () => options.readStringArray(Resources.angularTestIncludeField));
    if (include.length === 0)
      throw new BuildException(unnamed);
    const files: string[] = [];
    for await (const file of glob([...include], { cwd: this.directory }))
      files.push(this.specName(path.resolve(this.directory, file)));
    return files.sort();
  }

  public async readPathAliasesAsync(): Promise<ReadonlyMap<string, readonly string[]>> {
    if (!existsSync(this.projectFile))
      throw new BuildException(Resources.formatAngularTestNoProject(this.projectName));
    const project = await this.readJsonAsync(this.projectFile);
    const refused = Resources.formatAngularTestRefusedPaths(this.projectName);
    const paths = AngularTestProject.readField(refused, () => project.readObject(Resources.angularTestCompilerOptionsField).readObject(Resources.angularTestPathsField));
    const aliases = new Map<string, readonly string[]>();
    for (const alias of Object.keys(paths.toJson()))
      aliases.set(alias, AngularTestProject.readField(refused, () => paths.readStringArray(alias)).map(t => path.resolve(this.directory, t)));
    return aliases;
  }

  private async readResultsAsync(report: string): Promise<readonly JsonFields[]> {
    const reader = await this.readJsonAsync(report);
    const results = AngularTestProject.readField(Resources.formatAngularTestNoTestFiles(this.describe(report)), () => reader.readObjectArray(Resources.angularReportTestResultsField));
    return results.map(t => new JsonFields(t, this.describe(report)));
  }

  private async readCoverageAsync(summary: string): Promise<ICoverageCount> {
    const statements = new JsonFields(await this.readJsonAsync(summary), this.describe(summary)).object(Resources.angularCoverageTotalField).object(Resources.angularTestCoverageUnit);
    return { unit: Resources.angularTestCoverageUnit, covered: statements.count(Resources.angularCoverageCoveredField), total: statements.count(Resources.angularCoverageTotalField) };
  }

  private readRetried(result: JsonFields): readonly RetriedTest[] {
    const file = this.specName(path.resolve(result.text(Resources.nameField)));
    return result.objects(Resources.angularReportAssertionResultsField)
      .filter(t => t.text(Resources.angularReportStatusField) === Resources.angularTestPassedStatus && t.has(Resources.angularReportFailureMessagesField) && t.texts(Resources.angularReportFailureMessagesField).length > 0)
      .map(t => new RetriedTest(file, t.text(Resources.angularReportFullNameField), String(t.texts(Resources.angularReportFailureMessagesField)[0])));
  }

  private async readJsonAsync(file: string): Promise<JsonReader> {
    try {
      return JsonReader.parse(await readFile(file, Resources.encoding));
    }
    catch (error) {
      throw new BuildException(Resources.formatAngularTestUnreadableJson(this.describe(file), String(error)), new ExceptionOptions(error));
    }
  }

  private describe(file: string): string {
    return path.relative(this.root, file).split(path.sep).join(path.posix.sep);
  }

  private specName(file: string): string {
    return path.relative(this.sources, file).split(path.sep).join(path.posix.sep);
  }

  private projectPath(name: string): string {
    return path.relative(this.directory, path.join(this.sources, ...name.split(path.posix.sep))).split(path.sep).join(path.posix.sep);
  }

  private static environment(isRetrying: boolean): NodeJS.ProcessEnv {
    const namespaces = (process.env[Resources.angularTestDebugVariable] ?? String.empty).split(Resources.angularTestDebugNamespaceSeparator).map(t => t.trim()).filter(t => t.length > 0);
    const logged = namespaces.includes(Resources.angularTestLoggedNamespaces) ? namespaces : [...namespaces, Resources.angularTestLoggedNamespaces];
    const environment = { ...process.env, [Resources.angularTestDebugVariable]: logged.join(Resources.angularTestDebugNamespaceSeparator) };
    return isRetrying ? { ...environment, [Resources.angularTestRetryVariable]: Resources.angularTestRetryOn } : environment;
  }

  private static selectionArguments(include: readonly string[]): readonly string[] {
    return include.length === 0 ? [] : [Resources.angularTestNoCoverageOption, ...include.flatMap(t => [Resources.angularTestIncludeOption, t])];
  }

  private static findTestOptions(workspace: JsonReader): JsonReader | undefined {
    const projects = workspace.readObject(Resources.angularWorkspaceProjectsField);
    return Object.keys(projects.toJson())
      .map(t => Resources.angularTestOptionsPath.reduce<JsonReader | undefined>((reader, name) => reader?.hasField(name) === true ? reader.readObject(name) : undefined, projects.readObject(t)))
      .find(t => !Object.isUndefined(t));
  }

  private static readField<T>(message: string, read: () => T): T {
    try {
      return read();
    }
    catch (error) {
      throw new BuildException(Resources.formatAngularTestFieldUnreadable(message, String(error)), new ExceptionOptions(error));
    }
  }
}
