/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FocusTrapFactory } from "@angular/cdk/a11y";
import { Component, type Signal, afterRenderEffect, inject, untracked, viewChild } from "@angular/core";

import "@noldova/context.core";
import { DialogComponent, DialogSize, IconButtonComponent, TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.js";

import { TabLabelService } from "../../services/tab-label.service.js";
import { ViewDialogService } from "../../services/view-dialog.service.js";
import { TabSlotComponent } from "../tab-slot/tab-slot.component.js";

@Component({
  selector: "nol-view-dialog",
  imports: [DialogComponent, IconButtonComponent, TabSlotComponent, TooltipDirective],
  templateUrl: "./view-dialog.component.html",
  styleUrl: "./view-dialog.component.css"
})
export class ViewDialogComponent {
  private readonly focusTraps: FocusTrapFactory = inject(FocusTrapFactory);
  private readonly slot: Signal<TabSlotComponent> = viewChild.required(TabSlotComponent);

  protected readonly resources: typeof Resources = Resources;
  protected readonly large: DialogSize = DialogSize.Large;
  protected readonly dialogs: ViewDialogService = inject(ViewDialogService);
  protected readonly labels: TabLabelService = inject(TabLabelService);

  public constructor() {
    afterRenderEffect({
      read: () => {
        const content = this.slot().content();
        if (Object.isNull(content) || !content.isLoaded())
          return;
        untracked(() => {
          const trap = this.focusTraps.create(content.element, true);
          trap.focusFirstTabbableElement({ preventScroll: true });
          trap.destroy();
        });
      }
    });
  }
}
