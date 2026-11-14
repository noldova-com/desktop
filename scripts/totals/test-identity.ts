/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";

export class TestIdentity {
  public static of(file: string, names: readonly string[]): string {
    return [file, ...names].join(Resources.testIdentitySeparator);
  }
}
