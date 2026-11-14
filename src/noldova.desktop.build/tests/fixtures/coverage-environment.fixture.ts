/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

export class CoverageEnvironmentFixture {
  private static readonly COVERAGE_VARIABLE: string = "NODE_V8_COVERAGE";
  private static readonly COVERAGE_DIRECTORY_VARIABLE: string = "NOLDOVA_TEST_COVERAGE_DIRECTORY";

  public static forChild(base: Readonly<Record<string, string | undefined>>): Record<string, string | undefined> {
    const environment: Record<string, string | undefined> = { ...base };
    const directory = base[CoverageEnvironmentFixture.COVERAGE_DIRECTORY_VARIABLE];
    if (Object.isUndefined(directory))
      delete environment[CoverageEnvironmentFixture.COVERAGE_VARIABLE];
    else
      environment[CoverageEnvironmentFixture.COVERAGE_VARIABLE] = directory;

    return environment;
  }
}
