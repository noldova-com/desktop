/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";

import { Resources } from "../resources.js";

export class ServerSettings {
  public readonly maximumFrameLength: number;
  public readonly handshakeTimeout: number;
  public readonly defaultRequestTimeout: number;
  public readonly maximumRequestTimeout: number;
  public readonly updateSaveWait: number;
  public readonly updateBarrierHolderCheckInterval: number;

  public constructor(
    maximumFrameLength: number = Resources.maximumFrameLength,
    handshakeTimeout: number = Resources.handshakeTimeout,
    defaultRequestTimeout: number = Resources.defaultRequestTimeout,
    maximumRequestTimeout: number = Resources.maximumRequestTimeout,
    updateSaveWait: number = Resources.updateSaveWait,
    updateBarrierHolderCheckInterval: number = Resources.updateBarrierHolderCheckInterval) {
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumFrameLength, Resources.maximumFrameLengthParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(handshakeTimeout, Resources.handshakeTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(defaultRequestTimeout, Resources.defaultRequestTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(maximumRequestTimeout, Resources.maximumRequestTimeoutParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(updateSaveWait, Resources.updateSaveWaitParameterName);
    ArgumentOutOfRangeException.throwIfNotPositiveInteger(updateBarrierHolderCheckInterval, Resources.updateBarrierHolderCheckIntervalParameterName);
    if (defaultRequestTimeout > maximumRequestTimeout)
      throw new ArgumentOutOfRangeException(Resources.defaultRequestTimeoutParameterName, defaultRequestTimeout, Resources.defaultRequestTimeoutTooLong);

    this.maximumFrameLength = maximumFrameLength;
    this.handshakeTimeout = handshakeTimeout;
    this.defaultRequestTimeout = defaultRequestTimeout;
    this.maximumRequestTimeout = maximumRequestTimeout;
    this.updateSaveWait = updateSaveWait;
    this.updateBarrierHolderCheckInterval = updateBarrierHolderCheckInterval;
  }
}
