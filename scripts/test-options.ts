/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import path from "node:path";

import { Resources } from "./resources.ts";
import { TestOptionsProblem } from "./test-options-problem.ts";
import { TestOptionsException } from "./test-options.exception.ts";

export class TestOptions {
  public readonly isDocuments: boolean;
  public readonly filters: readonly string[];
  public readonly repeat: number;
  public readonly isRerunningFailed: boolean;
  public readonly isSkippingTestDetails: boolean;
  public readonly part: number | null;
  public readonly scriptFiles: readonly string[] | null;

  private constructor(isDocuments: boolean, filters: readonly string[], repeat: number, isRerunningFailed: boolean, isSkippingTestDetails: boolean, part: number | null, scriptFiles: readonly string[] | null = null) {
    this.isDocuments = isDocuments;
    this.filters = filters;
    this.repeat = repeat;
    this.isRerunningFailed = isRerunningFailed;
    this.isSkippingTestDetails = isSkippingTestDetails;
    this.part = part;
    this.scriptFiles = scriptFiles;
  }

  public static parse(args: readonly string[]): TestOptions {
    if (args[0] === Resources.testOptionsDocuments) {
      if (args.length !== 1)
        throw new TestOptionsException(TestOptionsProblem.DOCUMENTS_ALONE, args[1]);
      return new TestOptions(true, [], Resources.testOptionsDefaultRepeat, false, false, null);
    }
    if (args[0] === Resources.testOptionsScripts) {
      const files = args.slice(1);
      const refused = files.find(t => Resources.testOptionsGlobPattern.test(t) || !TestOptions.isScriptTest(t));
      if (!Object.isUndefined(refused))
        throw new TestOptionsException(TestOptionsProblem.SCRIPT_FILE, refused);
      return new TestOptions(false, [], Resources.testOptionsDefaultRepeat, false, false, null, files);
    }

    const filters: string[] = [];
    let repeat: number | null = null;
    let isRerunningFailed = false;
    let isSkippingTestDetails = false;
    let part: number | null = null;
    for (let index = 0; index < args.length; index++) {
      const option = args[index];
      if (option === Resources.testOptionsSkipTestDetailsOption)
        isSkippingTestDetails = true;
      else if (option === Resources.testOptionsRerunFailedOption) {
        if (isRerunningFailed)
          throw new TestOptionsException(TestOptionsProblem.RERUN_FAILED_ONCE, option);
        isRerunningFailed = true;
      }
      else if (option === Resources.testOptionsFilterOption)
        filters.push(TestOptions.readText(args[++index]));
      else if (option === Resources.testOptionsRepeatOption) {
        const value = args[++index] ?? String.empty;
        if (!Object.isNull(repeat))
          throw new TestOptionsException(TestOptionsProblem.REPEAT_ONCE, option);
        if (!Resources.testOptionsCountPattern.test(value))
          throw new TestOptionsException(TestOptionsProblem.REPEAT_VALUE, value);
        repeat = Number(value);
      }
      else if (!Object.isUndefined(option) && option.startsWith(Resources.testOptionsShardPrefix)) {
        if (!Object.isNull(part))
          throw new TestOptionsException(TestOptionsProblem.SHARD_ONCE, option);
        part = TestOptions.readPart(option);
      }
      else if (option !== Resources.testOptionsSkipCoverageDetailsOption)
        throw new TestOptionsException(TestOptionsProblem.UNKNOWN_OPTION, option);
    }
    if (!Object.isNull(part) && filters.length > 0)
      throw new TestOptionsException(TestOptionsProblem.SHARD_FILTERED, Resources.testOptionsFilterOption);
    return new TestOptions(false, filters, repeat ?? Resources.testOptionsDefaultRepeat, isRerunningFailed, isSkippingTestDetails, part);
  }

  private static isScriptTest(file: string): boolean {
    const normalized = file.replaceAll(Resources.testOptionsWindowsSeparator, Resources.testOptionsSeparator);
    return Resources.scriptTestFiles.some(t => path.posix.matchesGlob(normalized, t));
  }

  private static readPart(option: string): number {
    const match = Resources.testOptionsShardPattern.exec(option);
    if (Object.isNull(match) || Number(match[2]) !== Resources.testOptionsShardParts || Number(match[1]) > Resources.testOptionsShardParts)
      throw new TestOptionsException(TestOptionsProblem.SHARD_VALUE, option);
    return Number(match[1]);
  }

  private static readText(value: string | undefined): string {
    if (Object.isUndefined(value) || String.isNullOrWhitespace(value) || value.startsWith(Resources.testOptionsOptionPrefix))
      throw new TestOptionsException(TestOptionsProblem.FILTER_VALUE, value);
    return value;
  }
}
