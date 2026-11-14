/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ClientClosure {
  public readonly connection: number;
  public readonly window: number | null;

  public constructor(connection: number, window: number | null) {
    this.connection = connection;
    this.window = window;
  }
}
