/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class UnreadableReadFixture<T> {
  public readonly isRead: boolean;
  public readonly result: T;

  public constructor(isRead: boolean, result: T) {
    this.isRead = isRead;
    this.result = result;
  }
}
