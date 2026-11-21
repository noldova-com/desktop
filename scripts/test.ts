/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { appendFile } from "node:fs/promises";
import type { Writable } from "node:stream";

import "@noldova/context.core";

import { AngularTestProject } from "./angular/angular-test-project.ts";
import { AngularTestCheck } from "./checks/angular-test-check.ts";
import { CommentCheck } from "./checks/comment-check.ts";
import { DeclarationConsumerCheck } from "./checks/declaration-consumer-check.ts";
import { DeclaredDependencyCheck } from "./checks/declared-dependency-check.ts";
import { DependencyPinCheck } from "./checks/dependency-pin-check.ts";
import { DocumentCheck } from "./checks/document-check.ts";
import { FieldOrderCheck } from "./checks/field-order-check.ts";
import { FlakyRecord } from "./checks/flaky-record.ts";
import type { FlakyTest } from "./checks/flaky-test.ts";
import { GitHubConfigurationCheck } from "./checks/github-configuration-check.ts";
import { LicenseHeaderCheck } from "./checks/license-header-check.ts";
import type { ICheck } from "./checks/interfaces/i-check.ts";
import type { ISelectableCheck } from "./checks/interfaces/i-selectable-check.ts";
import { ModuleFolderCheck } from "./checks/module-folder-check.ts";
import { ModuleImportCheck } from "./checks/module-import-check.ts";
import { NameUniquenessCheck } from "./checks/name-uniqueness-check.ts";
import { NativeElementAssertionCheck } from "./checks/native-element-assertion-check.ts";
import { PackageCheck } from "./checks/package-check.ts";
import { PackageLayoutCheck } from "./checks/package-layout-check.ts";
import { PackageTestCheck } from "./checks/package-test-check.ts";
import { PreloadArgumentCheck } from "./checks/preload-argument-check.ts";
import { ProductIdentityCheck } from "./checks/product-identity-check.ts";
import { ReleaseScriptCheck } from "./checks/release-script-check.ts";
import { ReservedNamesCheck } from "./checks/reserved-names-check.ts";
import { ScriptTestCheck } from "./checks/script-test-check.ts";
import { SigningOutputCheck } from "./checks/signing-output-check.ts";
import { TestWaitCheck } from "./checks/test-wait-check.ts";
import { TypeCheck } from "./checks/type-check.ts";
import { UpdateTestRunCheck } from "./checks/update-test-run-check.ts";
import { VersionFileCaseCheck } from "./checks/version-file-case-check.ts";
import { VersionFileCheck } from "./checks/version-file-check.ts";
import { WebViewNamesCheck } from "./checks/web-view-names-check.ts";
import { WindowImportCheck } from "./checks/window-import-check.ts";
import { WindowNodeLoadCheck } from "./checks/window-node-load-check.ts";
import { ModuleCatalog } from "../src/noldova.desktop.build/src/services/modules/module-catalog.ts";
import { BuildLayout } from "../src/noldova.desktop.build/src/services/packages/build-layout.ts";
import { PackageBuild } from "../src/noldova.desktop.build/src/services/packages/package-build.ts";
import { PackageCatalog } from "../src/noldova.desktop.build/src/services/packages/package-catalog.ts";
import { ProductIdentity } from "../src/noldova.desktop.build/src/models/packages/product-identity.ts";
import { ProcessRunner } from "../src/noldova.desktop.build/src/services/processes/process-runner.ts";
import { Git } from "../src/noldova.desktop.build/src/services/repository/git.ts";
import { Resources } from "./resources.ts";
import { RepositoryFiles } from "./structure/repository-files.ts";
import { SourceTree } from "./structure/source-tree.ts";
import { TestOptions } from "./test-options.ts";
import { TestOptionsException } from "./test-options.exception.ts";
import { TestPart } from "./test-part.ts";
import { TestResources } from "./test.resources.ts";
import { RunnerTotals } from "./totals/runner-totals.ts";

export class Test {
  private readonly root: string;
  private readonly runner: ProcessRunner;
  private readonly output: Writable;
  private readonly environment: NodeJS.ProcessEnv;

  public constructor(root: string, runner: ProcessRunner, output: Writable, environment: NodeJS.ProcessEnv) {
    this.root = root;
    this.runner = runner;
    this.output = output;
    this.environment = environment;
  }

  public async runAsync(selection: readonly string[]): Promise<number> {
    let options: TestOptions;
    try {
      options = TestOptions.parse(selection);
    }
    catch (error) {
      if (!(error instanceof TestOptionsException))
        throw error;
      this.output.write(`${error.message}${Resources.lineEnd}${TestResources.usage}`);
      return Resources.usageExitCode;
    }
    if (options.isSkippingTestDetails)
      this.environment[TestResources.skipTestDetailsVariable] = TestResources.skipTestDetailsValue;
    if (options.isDocuments)
      return await this.runChecksAsync([this.createDocumentChecks()], TestResources.documentsNotice, null);

    const flaky = options.isRerunningFailed ? new FlakyRecord(this.root, this.environment) : null;
    await flaky?.clearAsync();

    for (let run = 1; run <= options.repeat; run++) {
      if (options.repeat > 1)
        this.output.write(TestResources.formatRunHeading(run, options.repeat));
      const exitCode = options.filters.length === 0
        ? await this.runChecksAsync(TestPart.select(await this.createChecksAsync(flaky), options.part, t => t instanceof PackageTestCheck, t => t instanceof PackageCheck), Object.isNull(options.part) ? null : TestResources.formatPartNotice(options.part), flaky)
        : await this.runFilteredAsync(options.filters, flaky);
      if (exitCode !== Resources.successExitCode) {
        if (options.repeat > 1)
          this.output.write(TestResources.formatRepeatStopped(run, options.repeat));
        return exitCode;
      }
    }
    if (options.repeat > 1)
      this.output.write(TestResources.formatAllRunsPassed(options.repeat));
    return Resources.successExitCode;
  }

  private async runChecksAsync(stages: readonly (readonly ICheck[])[], notice: string | null, flaky: FlakyRecord | null): Promise<number> {
    if (!Object.isNull(notice))
      this.output.write(notice);
    const earlier = (await flaky?.readAsync())?.length ?? 0;

    await RunnerTotals.clearAsync(this.root);
    const checks = stages.flat();
    let summary = TestResources.summaryHeader;
    let failures = 0;
    let ran = 0;
    for (const stage of stages) {
      if (failures > 0)
        break;
      for (const check of stage) {
        this.output.write(TestResources.formatCheckHeading(check.title));
        const passed = await check.runAsync(this.output);
        this.output.write(TestResources.formatCheckResult(check.title, passed ? TestResources.passedResult : TestResources.failedResult));
        summary += TestResources.formatSummaryRow(check.title, passed ? TestResources.passedLabel : TestResources.failedLabel);
        ran++;
        if (!passed)
          failures++;
      }
    }
    const stopped = checks.slice(ran);
    if (stopped.length > 0) {
      this.output.write(TestResources.formatStopped(stopped));
      summary += stopped.map(t => TestResources.formatSummaryRow(t.title, TestResources.notRunLabel)).join(String.empty);
    }

    const rerunPassed = Test.countByRunner((await flaky?.readAsync() ?? []).slice(earlier));
    const totals = (await RunnerTotals.readAllAsync(this.root, [Resources.packageTestRunner, Resources.angularTestRunner])).map(t => t.withRerunPassed(rerunPassed.get(t.title) ?? 0));
    if (totals.length > 0) {
      for (const runner of totals)
        await runner.writeAsync(this.root);
      this.output.write(TestResources.formatTotals(totals));
      summary += `${Resources.lineEnd}${RunnerTotals.formatTable(totals)}`;
    }
    this.output.write(TestResources.formatChecksPassed(ran - failures, checks.length));
    await this.writeSummaryAsync(summary);
    return failures === 0 ? Resources.successExitCode : Resources.failedExitCode;
  }

  private async writeSummaryAsync(summary: string): Promise<void> {
    const summaryPath = this.environment[Resources.summaryVariable];
    if (!Object.isUndefined(summaryPath))
      await appendFile(summaryPath, summary);
  }

  private async runFilteredAsync(filters: readonly string[], flaky: FlakyRecord | null): Promise<number> {
    this.output.write(TestResources.formatFilteredNotice(filters));
    const angular = new AngularTestProject(this.root);
    const checks: readonly ISelectableCheck[] = [
      new PackageTestCheck(this.root, new PackageBuild(this.root, this.runner, this.environment), this.environment, flaky),
      new AngularTestCheck(angular, flaky)
    ];

    let summary = TestResources.formatFilterSummary(filters);
    let failures = 0;
    let selected = 0;
    for (const check of checks) {
      this.output.write(TestResources.formatCheckHeading(check.title));
      const selection = await check.runSelectedAsync(filters, this.output);
      const result = !selection.isPassing ? TestResources.failedLabel : selection.selected === 0 ? TestResources.noneSelectedLabel : TestResources.passedLabel;
      this.output.write(TestResources.formatSelectionResult(check.title, result, selection));
      summary += TestResources.formatSelectionRow(check.title, result, selection);
      selected += selection.selected;
      if (!selection.isPassing)
        failures++;
    }
    if (selected === 0) {
      this.output.write(TestResources.noMatch);
      summary += `${Resources.lineEnd}${TestResources.noMatch}`;
      failures++;
    }

    this.output.write(TestResources.formatChecksPassed(checks.length - failures, checks.length));
    await this.writeSummaryAsync(summary);
    return failures === 0 ? Resources.successExitCode : Resources.failedExitCode;
  }

  private static countByRunner(tests: readonly FlakyTest[]): ReadonlyMap<string, number> {
    const counts = new Map<string, number>();
    for (const test of tests)
      counts.set(test.runner, (counts.get(test.runner) ?? 0) + 1);
    return counts;
  }

  private createDocumentChecks(): readonly ICheck[] {
    return [new DocumentCheck(this.root, new RepositoryFiles(this.root, new Git(this.root, this.runner)))];
  }

  private async createChecksAsync(flaky: FlakyRecord | null): Promise<readonly (readonly ICheck[])[]> {
    const files = new RepositoryFiles(this.root, new Git(this.root, this.runner));
    const { ApiCatalog } = await import("./api/api-catalog.ts");
    const { AngularFileCheck } = await import("./checks/angular-file-check.ts");
    const { ApiDeclarationCheck } = await import("./checks/api-declaration-check.ts");
    const { BucketNameCheck } = await import("./checks/bucket-name-check.ts");
    const { ConceptFileCheck } = await import("./checks/concept-file-check.ts");
    const { ConceptFolderCheck } = await import("./checks/concept-folder-check.ts");
    const { EnumValueCheck } = await import("./checks/enum-value-check.ts");
    const { InterfaceNameCheck } = await import("./checks/interface-name-check.ts");
    const { SyntaxTreeReader } = await import("./structure/syntax-tree.reader.ts");
    const syntax = new SyntaxTreeReader(this.root);
    const packages = new PackageCatalog(this.root);
    const tree = new SourceTree(this.root, files);
    const modules = new ModuleCatalog(this.root);
    const build = new PackageBuild(this.root, this.runner, this.environment);
    const angular = new AngularTestProject(this.root);
    const reading: readonly ICheck[] = [
      new DocumentCheck(this.root, files),
      new LicenseHeaderCheck(this.root, files),
      new CommentCheck(this.root, files),
      new TestWaitCheck(this.root, files),
      new NativeElementAssertionCheck(this.root, files),
      new FieldOrderCheck(this.root, files),
      new BucketNameCheck(files, syntax),
      new InterfaceNameCheck(files, syntax),
      new AngularFileCheck(files, syntax),
      new EnumValueCheck(files, syntax),
      new ConceptFileCheck(this.root, files, syntax),
      new ConceptFolderCheck(files, syntax),
      new GitHubConfigurationCheck(this.root, files),
      new ModuleFolderCheck(this.root, modules),
      new ProductIdentityCheck(tree, () => ProductIdentity.readAsync(this.root)),
      new ReservedNamesCheck(),
      new WebViewNamesCheck(),
      new PreloadArgumentCheck(),
      new ReleaseScriptCheck(this.root),
      new VersionFileCheck(this.root),
      new VersionFileCaseCheck(),
      new SigningOutputCheck(),
      new UpdateTestRunCheck(this.root),
      new ModuleImportCheck(this.root, tree, modules),
      new WindowImportCheck(tree, modules),
      new NameUniquenessCheck(tree, modules),
      new DeclaredDependencyCheck(tree),
      new DependencyPinCheck(this.root, files),
      new PackageLayoutCheck(this.root, packages)
    ];
    const building: readonly ICheck[] = [
      new PackageCheck(build),
      new PackageTestCheck(this.root, build, this.environment, flaky),
      new TypeCheck(this.root, this.runner),
      new ScriptTestCheck(this.root, this.runner),
      new ApiDeclarationCheck(this.root, new ApiCatalog(this.root, packages, new BuildLayout(this.root), angular, [])),
      new AngularTestCheck(angular, flaky),
      new WindowNodeLoadCheck(new BuildLayout(this.root), this.runner),
      new DeclarationConsumerCheck(new BuildLayout(this.root), this.runner)
    ];
    return [reading, building];
  }
}

if (import.meta.main)
  process.exitCode = await new Test(process.cwd(), new ProcessRunner(), process.stdout, process.env).runAsync(process.argv.slice(2));
