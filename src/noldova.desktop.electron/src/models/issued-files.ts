/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class IssuedFiles {
  public static readonly none: IssuedFiles = new IssuedFiles([], []);

  public readonly granted: readonly JsonObject[];
  public readonly refused: readonly string[];

  public constructor(granted: readonly JsonObject[], refused: readonly string[]) {
    this.granted = granted;
    this.refused = refused;
  }

  public toJson(): JsonObject {
    return { [Resources.grantedField]: [...this.granted], [Resources.refusedField]: [...this.refused] };
  }
}
