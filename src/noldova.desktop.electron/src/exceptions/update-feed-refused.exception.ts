/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../resources.js";
import { UpdateException } from "./update.exception.js";

export class UpdateFeedRefusedException extends UpdateException {
  public readonly status: number;

  public constructor(status: number) {
    super(Resources.formatUpdateFeedRefused(status));

    this.status = status;
  }
}
