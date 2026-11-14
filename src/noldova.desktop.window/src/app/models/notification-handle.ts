/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class NotificationHandle {
  private readonly remove: () => void;

  public readonly id: string;

  public constructor(id: string, remove: () => void) {
    this.id = id;
    this.remove = remove;
  }

  public dismiss(): void {
    this.remove();
  }
}
