/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PeerProcess {
  public readonly program: string;
  public readonly environment: readonly string[];
  public readonly sender: string | null;

  public constructor(program: string, environment: readonly string[], sender: string | null = null) {
    this.program = program;
    this.environment = environment;
    this.sender = sender;
  }
}
