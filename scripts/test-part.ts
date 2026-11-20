/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "./resources.ts";

export class TestPart {
  public static select<T>(stages: readonly (readonly T[])[], part: number | null, isPackageTests: (check: T) => boolean, isShared: (check: T) => boolean): readonly (readonly T[])[] {
    if (Object.isNull(part))
      return stages;
    const isPackageTestsPart = part === Resources.testPartPackageTests;
    return stages.map(t => t.filter(u => isShared(u) || isPackageTests(u) === isPackageTestsPart));
  }
}
