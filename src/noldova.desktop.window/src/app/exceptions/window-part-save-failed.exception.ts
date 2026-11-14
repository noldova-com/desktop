/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../../resources.js";
import { WindowPartFailureException } from "./window-part-failure.exception.js";

export class WindowPartSaveFailedException extends WindowPartFailureException {
  public override readonly name: string = "WindowPartSaveFailedException";
  public readonly productName: string;

  public constructor(moduleId: string, productName: string, cause: unknown) {
    super(Resources.formatWindowPartSaveFailed(productName), moduleId, new ExceptionOptions(cause));

    this.productName = productName;
  }
}
