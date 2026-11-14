/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ExceptionOptions } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";
import { UpdateHandoffException } from "./update-handoff.exception.js";

export class AppImageNotReplacedException extends UpdateHandoffException {
  public readonly image: string;

  public constructor(image: string, cause: unknown) {
    super(Resources.formatAppImageNotReplaced(image, String(cause)), new ExceptionOptions(cause));

    this.image = image;
  }
}
