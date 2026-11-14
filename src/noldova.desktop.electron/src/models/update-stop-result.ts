/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class UpdateStopResult {
  public readonly isHandedOff: boolean;
  public readonly isHandoffRecorded: boolean;

  private constructor(isHandedOff: boolean, isHandoffRecorded: boolean) {
    this.isHandedOff = isHandedOff;
    this.isHandoffRecorded = isHandoffRecorded;
  }

  public static cancelled(): UpdateStopResult {
    return new UpdateStopResult(false, false);
  }

  public static handedOff(isHandoffRecorded: boolean): UpdateStopResult {
    return new UpdateStopResult(true, isHandoffRecorded);
  }
}
