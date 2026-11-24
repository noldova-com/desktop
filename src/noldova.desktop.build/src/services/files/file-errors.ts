/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";

export class FileErrors {
  public static isMissing(error: unknown): boolean {
    return FileErrors.hasCode(error, Resources.missingFileCodes);
  }

  public static isUnreachable(error: unknown): boolean {
    return FileErrors.hasCode(error, Resources.unreachableFileCodes);
  }

  public static isDenied(error: unknown): boolean {
    return FileErrors.hasCode(error, Resources.deniedFileCodes);
  }

  private static hasCode(error: unknown, codes: ReadonlySet<string>): boolean {
    const code: unknown = error instanceof Error && Resources.errorCodeField in error ? error[Resources.errorCodeField] : undefined;
    return Object.isString(code) && codes.has(code);
  }
}
