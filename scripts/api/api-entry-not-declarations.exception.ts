/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.ts";
import { ApiException } from "./api.exception.ts";

export class ApiEntryNotDeclarationsException extends ApiException {
  public readonly file: string;
  public readonly subpath: string;
  public readonly declarations: string;

  public constructor(file: string, subpath: string, declarations: string) {
    super(Resources.formatApiEntryNotDeclarations(file, subpath, declarations));

    this.file = file;
    this.subpath = subpath;
    this.declarations = declarations;
  }
}
