/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ApiException } from "./api.exception.ts";

export class ApiEntryUntypedException extends ApiException {
  public readonly file: string;
  public readonly subpaths: readonly string[];

  public constructor(file: string, subpaths: readonly string[]) {
    super(Resources.formatApiEntryUntyped(file, subpaths));

    this.file = file;
    this.subpaths = subpaths;
  }
}
