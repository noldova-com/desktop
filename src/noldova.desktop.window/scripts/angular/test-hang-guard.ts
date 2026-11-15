/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import type { IReportedHook } from "./interfaces/i-reported-hook.ts";
import type { IReportedModule } from "./interfaces/i-reported-module.ts";
import type { IReportedTest } from "./interfaces/i-reported-test.ts";
import type { IVitestReporterContext } from "./interfaces/i-vitest-reporter-context.ts";

export class TestHangGuard {
  public static readonly LIMIT_MILLISECONDS: number = 60_000;

  private static readonly NAME: string = "noldova-test-hang-guard";
  private static readonly FAILED: number = 1;

  private readonly limit: number;
  private readonly end: () => void;
  private readonly watches: Map<string, NodeJS.Timeout> = new Map();
  private readonly running: Map<string, string> = new Map();
  private readonly finished: Map<string, string> = new Map();
  private readonly hooks: Map<string, string> = new Map();
  private run: NodeJS.Timeout | undefined = undefined;
  private isStopped: boolean = false;
  private report: (message: string) => void = () => undefined;

  public readonly name: string = TestHangGuard.NAME;
  public readonly configureVitest: (context: IVitestReporterContext) => void = context => {
    this.report = message => context.vitest.logger.error(message);
    context.vitest.config.reporters.push(this);
  };
  public readonly onTestRunStart: () => void = () => this.watchRun();
  public readonly onTestModuleQueued: (module: IReportedModule) => void = module => this.watch(module.relativeModuleId);
  public readonly onTestModuleCollected: (module: IReportedModule) => void = module => this.watch(module.relativeModuleId);
  public readonly onTestModuleStart: (module: IReportedModule) => void = module => this.watch(module.relativeModuleId);
  public readonly onHookStart: (hook: IReportedHook) => void = hook => {
    const file = TestHangGuard.fileOf(hook);
    this.hooks.set(file, hook.name);
    this.watch(file);
  };
  public readonly onHookEnd: (hook: IReportedHook) => void = hook => {
    const file = TestHangGuard.fileOf(hook);
    this.hooks.delete(file);
    this.watch(file);
  };
  public readonly onTestCaseReady: (test: IReportedTest) => void = test => {
    this.running.set(test.module.relativeModuleId, test.fullName);
    this.watch(test.module.relativeModuleId);
  };
  public readonly onTestCaseResult: (test: IReportedTest) => void = test => {
    this.running.delete(test.module.relativeModuleId);
    this.finished.set(test.module.relativeModuleId, test.fullName);
    this.watch(test.module.relativeModuleId);
  };
  public readonly onTestModuleEnd: (module: IReportedModule) => void = module => {
    this.forget(module.relativeModuleId);
    this.touchRun();
  };
  public readonly onTestRunEnd: () => void = () => {
    for (const file of [...this.watches.keys()])
      this.forget(file);
    clearTimeout(this.run);
    this.run = undefined;
  };

  public constructor(limit: number = TestHangGuard.LIMIT_MILLISECONDS, end: () => void = TestHangGuard.exit) {
    this.limit = limit;
    this.end = end;
  }

  private watch(file: string): void {
    clearTimeout(this.watches.get(file));
    this.watches.set(file, setTimeout(() => this.stop(this.describeFile(file)), this.limit).unref());
    this.touchRun();
  }

  private watchRun(): void {
    clearTimeout(this.run);
    this.run = setTimeout(() => this.stop(this.describeRun()), this.limit).unref();
  }

  private touchRun(): void {
    if (!Object.isUndefined(this.run))
      this.watchRun();
  }

  private forget(file: string): void {
    clearTimeout(this.watches.get(file));
    this.watches.delete(file);
    this.running.delete(file);
    this.finished.delete(file);
    this.hooks.delete(file);
  }

  private stop(message: string): void {
    if (this.isStopped)
      return;
    this.isStopped = true;
    this.report(message);
    this.onTestRunEnd();
    this.end();
  }

  private describeFile(file: string): string {
    return `The Angular tests stopped: ${file} reported nothing for ${this.limit / 1_000} s ${this.phaseOf(file)}.`;
  }

  private describeRun(): string {
    const files = [...this.watches.keys()];
    return files.length === 0
      ? `The Angular tests stopped: Vitest reported nothing for ${this.limit / 1_000} s between files, with every file that started ended.`
      : `The Angular tests stopped: Vitest reported nothing for ${this.limit / 1_000} s, with these files started and not ended: ${files.map(t => `${t} ${this.phaseOf(t)}`).join("; ")}.`;
  }

  private phaseOf(file: string): string {
    const test = this.running.get(file);
    const hook = this.hooks.get(file);
    const inHook = Object.isUndefined(hook) ? String.empty : `, in its ${hook} hook`;
    if (!Object.isUndefined(test))
      return `while its test "${test}" ran${inHook}, past Vitest's own limits`;
    if (!Object.isUndefined(hook))
      return `in its ${hook} hook, past Vitest's own limits`;
    const last = this.finished.get(file);
    return Object.isUndefined(last)
      ? "before its first test: while it loaded or collected its tests"
      : `after its test "${last}" finished: in the next test's start, or the file's end, where the browser cleans up and hands over its coverage`;
  }

  private static fileOf(hook: IReportedHook): string {
    return "module" in hook.entity ? hook.entity.module.relativeModuleId : hook.entity.relativeModuleId;
  }

  private static exit(): void {
    process.exitCode = TestHangGuard.FAILED;
    process.stderr.write(String.empty, () => process.exit(TestHangGuard.FAILED));
  }
}
