/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { PermissionOption } from "../enums/permission-option.js";
import type { ToolRisk } from "../enums/tool-risk.js";
import type { IPermissionDetail } from "./i-permission-detail.js";

export interface IPermissionRequest {
  readonly action: string;
  readonly subject?: string | undefined;
  readonly title: string;
  readonly details: readonly IPermissionDetail[];
  readonly risk: ToolRisk;
  readonly isAsking?: boolean | undefined;
  readonly options: readonly PermissionOption[];
  readonly labels?: Readonly<Partial<Record<PermissionOption.AllowAlways | PermissionOption.TakeOver, string>>> | undefined;
  readonly isRememberedOnly?: boolean | undefined;
}
