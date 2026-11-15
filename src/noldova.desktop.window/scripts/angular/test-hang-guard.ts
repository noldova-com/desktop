/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

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
  private report: (message: string) => void = () => undefined;

  public readonly name: string = TestHangGuard.NAME;
  public readonly configureVitest: (context: IVitestReporterContext) => void = context => {
    this.report = message => context.vitest.logger.error(message);
    context.vitest.config.reporters.push(this);
  };
  public readonly onTestModuleStart: (module: IReportedModule) => void = module => this.watch(module.relativeModuleId);
  public readonly onTestCaseReady: (test: IReportedTest) => void = test => {
    this.running.set(test.module.relativeModuleId, test.fullName);
    this.watch(test.module.relativeModuleId);
  };
  public readonly onTestCaseResult: (test: IReportedTest) => void = test => {
    this.running.delete(test.module.relativeModuleId);
    this.finished.set(test.module.relativeModuleId, test.fullName);
    this.watch(test.module.relativeModuleId);
  };
  public readonly onTestModuleEnd: (module: IReportedModule) => void = module => this.forget(module.relativeModuleId);
  public readonly onTestRunEnd: () => void = () => {
    for (const file of [...this.watches.keys()])
      this.forget(file);
  };

  public constructor(limit: number = TestHangGuard.LIMIT_MILLISECONDS, end: () => void = TestHangGuard.exit) {
    this.limit = limit;
    this.end = end;
  }

  private watch(file: string): void {
    clearTimeout(this.watches.get(file));
    this.watches.set(file, setTimeout(() => this.stop(file), this.limit).unref());
  }

  private forget(file: string): void {
    clearTimeout(this.watches.get(file));
    this.watches.delete(file);
    this.running.delete(file);
    this.finished.delete(file);
  }

  private stop(file: string): void {
    this.report(this.describe(file));
    this.forget(file);
    this.end();
  }

  private describe(file: string): string {
    const silence = `The Angular tests stopped: ${file} reported nothing for ${this.limit / 1_000} s`;
    const test = this.running.get(file);
    if (!Object.isUndefined(test))
      return `${silence} while its test "${test}" ran, past Vitest's own limits.`;
    const last = this.finished.get(file);
    return Object.isUndefined(last)
      ? `${silence} before its first test: while it loaded, collected its tests or ran a beforeAll hook.`
      : `${silence} after its test "${last}" finished: in an afterAll hook, the next test's start, or the file's end, where the browser cleans up and hands over its coverage.`;
  }

  private static exit(): void {
    process.exitCode = TestHangGuard.FAILED;
    process.stderr.write(String.empty, () => process.exit(TestHangGuard.FAILED));
  }
}
