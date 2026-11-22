/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, inject } from "@angular/core";

import "@noldova/context.core";

import type { ToolbarBandPage } from "../../models/toolbar-band-page.js";
import { PageTokens } from "../../models/page-tokens.js";
import { ToolbarBandComponent } from "../toolbar-band/toolbar-band.component.js";

@Component({
  selector: "nol-view-toolbar-band",
  imports: [ToolbarBandComponent],
  templateUrl: "./view-toolbar-band.component.html"
})
export class ViewToolbarBandComponent {
  protected readonly page: ToolbarBandPage | null = inject(PageTokens.toolbarBand, { optional: true });
}
