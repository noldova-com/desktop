/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { InjectionToken } from "@angular/core";

import { Resources } from "../../resources.js";
import type { ToolbarBandPage } from "./toolbar-band-page.js";

export class PageTokens {
  public static readonly toolbarBand: InjectionToken<ToolbarBandPage> = new InjectionToken<ToolbarBandPage>(Resources.toolbarBandPageToken);
}
