/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ConfigurationFileFixture {
  public readonly variable: string;
  public readonly file: string;

  public constructor(variable: string, file: string) {
    this.variable = variable;
    this.file = file;
  }
}
