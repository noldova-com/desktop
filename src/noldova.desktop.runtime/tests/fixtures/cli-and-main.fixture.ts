/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { RawConnectionFixture } from "./raw-connection.fixture.js";

export class CliAndMainFixture {
  public readonly cli: RawConnectionFixture;
  public readonly main: RawConnectionFixture;

  public constructor(cli: RawConnectionFixture, main: RawConnectionFixture) {
    this.cli = cli;
    this.main = main;
  }
}
