/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class EnvironmentCaseFixture {
  public readonly environment: NodeJS.ProcessEnv;
  public readonly message: string;

  public constructor(environment: NodeJS.ProcessEnv, message: string) {
    this.environment = environment;
    this.message = message;
  }
}
