/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { UpdateBarrierStatus } from "../enums/update-barrier-status.js";
import { ProductInfo } from "../models/product-info.js";
import { Resources } from "../resources.js";
import { RuntimeException } from "./runtime.exception.js";

export class UpdateInProgressException extends RuntimeException {
  public readonly status: UpdateBarrierStatus;

  public constructor(status: UpdateBarrierStatus) {
    super(status === UpdateBarrierStatus.Unfinished ? Resources.formatUpdateUnfinished(ProductInfo.current.name) : Resources.formatUpdateInProgress(ProductInfo.current.name));

    this.status = status;
  }
}
