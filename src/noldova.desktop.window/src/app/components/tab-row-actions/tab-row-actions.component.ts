/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */


import { Component, type Signal, computed, inject, input } from "@angular/core";

import "@noldova/context.core";
import { IconButtonComponent, MenuTriggerDirective, OverlayAlignment, OverlaySide, TooltipDirective } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.js";
import type { CommandRow } from "../../models/command-row.js";
import type { TabGroup } from "../../models/layout/tab-group.js";
import type { SubmenuRow } from "../../models/submenu-row.js";
import { TabRowService } from "../../services/tab-row.service.js";
import { PlaceMenuComponent } from "../place-menu/place-menu.component.js";

@Component({
  selector: "nol-tab-row-actions",
  imports: [IconButtonComponent, MenuTriggerDirective, PlaceMenuComponent, TooltipDirective],
  templateUrl: "./tab-row-actions.component.html",
  styleUrl: "./tab-row-actions.component.css"
})
export class TabRowActionsComponent {
  private readonly tabRows: TabRowService = inject(TabRowService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly end: OverlayAlignment = OverlayAlignment.End;
  protected readonly rows: Signal<readonly (CommandRow | SubmenuRow)[]> = computed(() => this.tabRows.rowsOf(this.group()));

  public readonly group = input.required<TabGroup>();

  protected tooltipOf(row: CommandRow): string {
    return Object.isNull(row.key) ? row.title : Resources.formatShortcutTitle(row.title, row.key);
  }

  protected run(row: CommandRow): void {
    this.tabRows.run(row);
  }
}
