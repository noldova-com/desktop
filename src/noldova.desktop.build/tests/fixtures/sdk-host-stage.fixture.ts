/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SdkHostStageFixture {
  public readonly failure: string | null;
  public readonly version: string | null;
  public readonly overrides: unknown;

  public constructor(failure: string | null, version: string | null, overrides: unknown) {
    this.failure = failure;
    this.version = version;
    this.overrides = overrides;
  }
}
