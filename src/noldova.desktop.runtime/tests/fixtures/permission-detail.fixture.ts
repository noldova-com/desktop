/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IPermissionDetail, PermissionDetailKind } from "@noldova/desktop.runtime";

export class PermissionDetailFixture implements IPermissionDetail {
  public readonly label: string;
  public readonly kind: PermissionDetailKind;
  private readonly text: string;

  public constructor(label: string, kind: PermissionDetailKind, text: string) {
    this.label = label;
    this.kind = kind;
    this.text = text;
  }

  public get value(): string {
    return this.text;
  }
}
