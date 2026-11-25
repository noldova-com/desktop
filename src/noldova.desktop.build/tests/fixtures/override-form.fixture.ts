/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class OverrideFormFixture {
  public readonly overrides: Readonly<Record<string, unknown>>;
  public readonly fields: Readonly<Record<string, unknown>>;
  public readonly expected: Readonly<Record<string, unknown>>;

  public constructor(overrides: Readonly<Record<string, unknown>>, fields: Readonly<Record<string, unknown>>, expected: Readonly<Record<string, unknown>>) {
    this.overrides = overrides;
    this.fields = fields;
    this.expected = expected;
  }
}
