/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ListingCommandFixture {
  public readonly command: string;
  public readonly commandArguments: readonly string[];

  public constructor(command: string, commandArguments: readonly string[]) {
    this.command = command;
    this.commandArguments = commandArguments;
  }
}
