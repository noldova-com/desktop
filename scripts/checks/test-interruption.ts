/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */
import { performance } from "node:perf_hooks";

import "@noldova/context.core";
import { type DiscoveredTestClass, TestClassResult, type TestMethodResult, TestTimeoutException } from "@noldova/context.testing";

import { Resources } from "../resources.ts";
import { ScriptException } from "../script.exception.ts";
import { TestStep } from "./test-step.ts";

export class TestInterruption {
  private readonly methodResults: TestMethodResult[] = [];
  private readonly steps: TestStep[] = [];
  private testClass: DiscoveredTestClass | null = null;
  private resources: readonly string[] = [];
  private text: string | null = null;

  public get isInterrupted(): boolean {
    return !Object.isNull(this.text);
  }

  public get message(): string | null {
    return this.text;
  }

  public static listAdded(before: readonly string[], after: readonly string[]): string[] {
    const left = [...before];
    return after.filter(t => {
      const index = left.indexOf(t);
      if (index < 0)
        return true;
      left.splice(index, 1);
      return false;
    });
  }

  public start(testClass: DiscoveredTestClass): void {
    this.testClass = testClass;
    this.resources = process.getActiveResourcesInfo();
    this.steps.splice(0);
  }

  public startStep(name: string, at: number): void {
    this.steps.push(new TestStep(name, at));
  }

  public endStep(name: string, at: number): void {
    this.steps.findLast(t => t.name === name && t.isRunning)?.end(at);
  }

  public complete(methodResult: TestMethodResult): void {
    const testClass = this.requireClass();
    this.methodResults.push(methodResult);
    if (methodResult.failure instanceof TestTimeoutException)
      this.text = Resources.formatSerialTestInterrupted(`${testClass.packageName}${Resources.pathSeparator}${testClass.filePath}${Resources.testIdentitySeparator}${methodResult.displayName}`,
        methodResult.failure.timeoutMilliseconds, TestInterruption.listAdded(this.resources, process.getActiveResourcesInfo()), this.formatSteps(performance.now()));
  }

  public finishClass(): void {
    this.methodResults.splice(0);
  }

  public collectStopped(): TestClassResult | null {
    if (this.methodResults.length === 0)
      return null;
    const testClass = this.requireClass();
    return new TestClassResult(testClass.packageName, testClass.className, testClass.filePath, [...this.methodResults]);
  }

  private formatSteps(now: number): string[] {
    const formatted = this.steps.map(t => t.format(now));
    const last = this.steps.at(-1);
    return Object.isUndefined(last) || this.steps.some(t => t.isRunning) ? formatted : [...formatted, last.formatAfter(now)];
  }

  private requireClass(): DiscoveredTestClass {
    if (Object.isNull(this.testClass))
      throw new ScriptException(Resources.serialTestMethodWithoutClass);
    return this.testClass;
  }
}
