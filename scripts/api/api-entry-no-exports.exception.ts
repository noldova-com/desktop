/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ApiException } from "./api.exception.ts";

export class ApiEntryNoExportsException extends ApiException {
  public readonly file: string;

  public constructor(file: string) {
    super(Resources.formatApiEntryNoExports(file));

    this.file = file;
  }
}
