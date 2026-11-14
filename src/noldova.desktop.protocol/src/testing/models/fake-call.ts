/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class FakeCall<T extends object> {
  public readonly member: keyof T & string;
  public readonly args: readonly unknown[];

  public constructor(member: keyof T & string, args: readonly unknown[]) {
    this.member = member;
    this.args = args;
  }
}
