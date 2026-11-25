/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Response } from "@noldova/desktop.protocol";

import type { RawConnectionFixture } from "./raw-connection.fixture.js";

export class HandshakeAnswerFixture {
  public readonly connection: RawConnectionFixture;
  public readonly response: Response;

  public constructor(connection: RawConnectionFixture, response: Response) {
    this.connection = connection;
    this.response = response;
  }
}
