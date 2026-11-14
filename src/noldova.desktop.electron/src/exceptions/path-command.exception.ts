/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { ElectronException } from "./electron.exception.js";

export class PathCommandException extends ElectronException {
  public readonly link: string;

  public constructor(link: string, cause: unknown) {
    super(Resources.formatPathCommandFailed(link, String(cause)), new ExceptionOptions(cause));

    this.link = link;
  }
}
