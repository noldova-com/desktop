/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "./resources.ts";

export class TestOptionsProblem {
  public static readonly DOCUMENTS_ALONE: TestOptionsProblem = new TestOptionsProblem(() => Resources.testOptionsDocumentsAlone);
  public static readonly FILTER_VALUE: TestOptionsProblem = new TestOptionsProblem(() => Resources.testOptionsFilterValue);
  public static readonly REPEAT_VALUE: TestOptionsProblem = new TestOptionsProblem(() => Resources.testOptionsRepeatValue);
  public static readonly REPEAT_ONCE: TestOptionsProblem = new TestOptionsProblem(() => Resources.testOptionsRepeatOnce);
  public static readonly RERUN_FAILED_ONCE: TestOptionsProblem = new TestOptionsProblem(() => Resources.testOptionsRerunFailedOnce);
  public static readonly UNKNOWN_OPTION: TestOptionsProblem = new TestOptionsProblem(t => Resources.formatTestOptionsUnknownOption(t));

  private readonly formatMessage: (argument: string | undefined) => string;

  private constructor(formatMessage: (argument: string | undefined) => string) {
    this.formatMessage = formatMessage;
  }

  public format(argument: string | undefined): string {
    return this.formatMessage(argument);
  }
}
