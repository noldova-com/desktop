/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class AppleRequirement {
  public readonly requirement: string;
  public readonly isMet: boolean;

  public constructor(requirement: string, isMet: boolean) {
    this.requirement = requirement;
    this.isMet = isMet;
  }
}
