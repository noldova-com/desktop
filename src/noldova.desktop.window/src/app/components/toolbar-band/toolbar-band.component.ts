/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, inject } from "@angular/core";

import "@noldova/context.core";
import { ContextMenuTriggerDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.js";
import type { Toolbar } from "../../models/toolbar.js";
import { ToolbarDragService } from "../../services/toolbar-drag.service.js";
import { ToolbarService } from "../../services/toolbar.service.js";
import { PlaceMenuComponent } from "../place-menu/place-menu.component.js";
import { ToolbarComponent } from "../toolbar/toolbar.component.js";

@Component({
  selector: "nol-toolbar-band",
  imports: [ContextMenuTriggerDirective, NgTemplateOutlet, PlaceMenuComponent, ToolbarComponent],
  templateUrl: "./toolbar-band.component.html",
  styleUrl: "./toolbar-band.component.css"
})
export class ToolbarBandComponent {
  protected readonly resources: typeof Resources = Resources;
  protected readonly toolbars: ToolbarService = inject(ToolbarService);
  protected readonly drag: ToolbarDragService = inject(ToolbarDragService);

  protected hasContent(row: readonly Toolbar[]): boolean {
    return row.some(t => t.sections.length > 0);
  }
}
