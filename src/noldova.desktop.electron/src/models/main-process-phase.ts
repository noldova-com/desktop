/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class MainProcessPhase {
  public hasPassedBarrier: boolean = false;
  public isReady: boolean = false;
  public isExiting: boolean = false;
}
