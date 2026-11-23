/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import { Component, ElementRef, type Signal, computed, inject, input, viewChild } from "@angular/core";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";
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
  private readonly toolbars: ToolbarService = inject(ToolbarService);
  private readonly bandElement: Signal<ElementRef<HTMLElement> | undefined> = viewChild<ElementRef<HTMLElement>>("band");

  protected readonly resources: typeof Resources = Resources;
  protected readonly drag: ToolbarDragService = inject(ToolbarDragService);
  protected readonly id: string = crypto.randomUUID();

  public readonly band = input<string | null>(null);
  public readonly context = input<JsonObject>({});
  protected readonly bandRows: Signal<readonly (readonly Toolbar[])[]> = computed(() => this.toolbars.rowsOf(this.band(), this.context()));
  protected readonly hasAnyContent: Signal<boolean> = computed(() => this.bandRows().some(row => this.hasContent(row)));
  protected readonly menuContext: Signal<JsonObject> = computed(() => {
    const band = this.band();
    return Object.isNull(band) ? this.context() : { ...this.context(), [Resources.bandArgument]: band };
  });
  protected readonly isDropHere: Signal<boolean> = computed(() => this.drag.band() === this.bandElement()?.nativeElement);

  protected hasContent(row: readonly Toolbar[]): boolean {
    return row.some(t => t.sections.length > 0);
  }
}
