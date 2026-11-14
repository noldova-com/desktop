/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class PermissionRevocation {
  public readonly action: string;
  public readonly subject: string | null;
  public readonly scope: string;

  public constructor(action: string, subject: string | null, scope: string) {
    this.action = action;
    this.subject = subject;
    this.scope = scope;
  }
}
