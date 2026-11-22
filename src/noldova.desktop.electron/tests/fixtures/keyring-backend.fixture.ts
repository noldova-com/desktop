/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class KeyringBackendFixture {
  public readonly platform: string;
  public readonly backend: string;

  public constructor(platform: string, backend: string) {
    this.platform = platform;
    this.backend = backend;
  }
}
