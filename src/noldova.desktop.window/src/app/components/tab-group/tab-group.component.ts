/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NgTemplateOutlet } from "@angular/common";
import {
  Component, DestroyRef, ElementRef, type Signal, computed, effect, inject, input, untracked, viewChild
} from "@angular/core";

import "@noldova/context.core";
import {
  ContextMenuTriggerDirective, IconButtonComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, OverlayAlignment, OverlaySide,
  PanelCardComponent, PanelSurface, TabComponent, TooltipDirective
} from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.js";
import { TabScrollerDirective } from "../../directives/tab-scroller.directive.js";
import { DockSide } from "../../enums/dock-side.js";
import type { CommandRow } from "../../models/command-row.js";
import type { GroupFrame } from "../../models/layout/group-frame.js";
import type { Tab } from "../../models/layout/tab.js";
import type { TabGroup } from "../../models/layout/tab-group.js";
import type { SubmenuRow } from "../../models/submenu-row.js";
import { CommandService } from "../../services/command.service.js";
import { LayoutService } from "../../services/layout.service.js";
import { TabDestinationsService } from "../../services/tab-destinations.service.js";
import { TabDragService } from "../../services/tab-drag.service.js";
import { TabFocusService } from "../../services/tab-focus.service.js";
import { TabLabelService } from "../../services/tab-label.service.js";
import { TabRenameService } from "../../services/tab-rename.service.js";
import { TabRowService } from "../../services/tab-row.service.js";
import { TabStripService } from "../../services/tab-strip.service.js";
import { PlaceMenuComponent } from "../place-menu/place-menu.component.js";
import { TabRowActionsComponent } from "../tab-row-actions/tab-row-actions.component.js";

@Component({
  selector: "nol-tab-group",
  imports: [
    ContextMenuTriggerDirective, IconButtonComponent, MenuComponent, MenuItemComponent, MenuSeparatorComponent, MenuTriggerDirective, NgTemplateOutlet, PanelCardComponent, PlaceMenuComponent,
    TabComponent, TabRowActionsComponent, TabScrollerDirective, TooltipDirective
  ],
  templateUrl: "./tab-group.component.html",
  styleUrl: "./tab-group.component.css",
  host: {
    "[attr.data-group]": "group().id",
    "[attr.data-side]": "frame().side",
    "[style.left.rem]": "frame().bounds.x",
    "[style.top.rem]": "frame().bounds.y",
    "[style.width.rem]": "frame().bounds.width",
    "[style.height.rem]": "frame().bounds.height",
    "(focusin)": "layout.focusGroup(group().id)"
  }
})
export class TabGroupComponent {
  private readonly host: HTMLElement = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly tabFocus: TabFocusService = inject(TabFocusService);
  private readonly commands: CommandService = inject(CommandService);
  private readonly scroller: Signal<TabScrollerDirective | undefined> = viewChild(TabScrollerDirective);
  private readonly overflowTrigger: Signal<MenuTriggerDirective | undefined> = viewChild("overflowTrigger", { read: MenuTriggerDirective });

  protected readonly resources: typeof Resources = Resources;
  protected readonly below: OverlaySide = OverlaySide.below;
  protected readonly besides: OverlaySide = OverlaySide.end;
  protected readonly end: OverlayAlignment = OverlayAlignment.End;
  protected readonly layout: LayoutService = inject(LayoutService);
  protected readonly drag: TabDragService = inject(TabDragService);
  protected readonly labels: TabLabelService = inject(TabLabelService);
  protected readonly renames: TabRenameService = inject(TabRenameService);
  protected readonly tabRows: TabRowService = inject(TabRowService);
  protected readonly group: Signal<TabGroup> = computed(() => this.frame().group);
  protected readonly rowActions: Signal<readonly (CommandRow | SubmenuRow)[]> = computed(() => this.tabRows.rowsOf(this.group()));
  protected readonly surface: Signal<PanelSurface> = computed(() => Object.isNull(this.frame().side) ? PanelSurface.Panel : PanelSurface.Shell);
  protected readonly isShell: Signal<boolean> = computed(() => this.surface() === PanelSurface.Shell);
  protected readonly panelId: Signal<string> = computed(() => `${Resources.tabPanelIdPrefix}${this.group().id}`);
  protected readonly isDropAtEnd: Signal<boolean> = computed(() => this.drag.isDropBefore(this.group().id, this.group().tabs.length));
  protected readonly activeTabId: Signal<string | null> = computed(() => {
    const index = this.group().tabs.findIndex(t => t.equals(this.group().active));
    return index < 0 ? null : this.tabId(index);
  });
  protected readonly header: Signal<Tab | null> = computed(() => {
    const side = this.frame().side;
    return !Object.isNull(side) && side !== DockSide.Bottom && this.layout.iconSides().has(side) ? this.group().active : null;
  });
  protected readonly hideSide: Signal<DockSide | null> = computed(() => {
    const side = this.frame().side;
    return !Object.isNull(side) && this.layout.layout().dock(side).root?.cornerGroup.id === this.group().id ? side : null;
  });

  public readonly frame = input.required<GroupFrame>();

  public constructor() {
    const strips = inject(TabStripService);
    inject(TabDestinationsService);
    effect(() => strips.setOverflowing(this.group().id, this.scroller()?.isOverflowing() ?? false));
    effect(() => {
      const group = this.group();
      untracked(() => this.tabFocus.followActive(group.tabs, group.active));
    });
    effect(() => {
      const trigger = this.overflowTrigger();
      if (!Object.isUndefined(trigger) && strips.takeListRequest(this.group().id)) {
        trigger.open();
        trigger.getMenu()?.focusFirstItem(Resources.keyboardFocusOrigin);
      }
    });
    inject(DestroyRef).onDestroy(() => strips.setOverflowing(this.group().id, false));
  }

  protected tabId(index: number): string {
    return `${Resources.tabIdPrefix}${this.group().id}${Resources.tabIdSeparator}${index}`;
  }

  protected choose(tab: Tab): void {
    this.layout.activate(tab);
    this.tabFocus.focus(tab);
  }

  protected onTabPointerDown(tab: Tab, event: PointerEvent): void {
    if (!tab.equals(this.renames.editing()))
      this.drag.begin(tab, event);
  }

  protected onTabClick(tab: Tab, event: MouseEvent): void {
    if (event.detail > 0)
      this.tabFocus.focusContent(tab);
  }

  protected close(tab: Tab): void {
    const hadFocus = this.host.contains(this.host.ownerDocument.activeElement);
    this.layout.close(tab);
    const next = this.layout.layout().group(this.group().id)?.active ?? this.layout.currentGroup().active;
    if (hadFocus && !Object.isNull(next))
      this.tabFocus.focus(next);
  }

  protected onTabDoubleClick(tab: Tab): void {
    if (this.renames.canRename(tab))
      this.renames.begin(tab);
    else
      this.commands.run(Resources.keepTabCommand, { [Resources.tabArgument]: tab.key });
  }

  protected closeAll(): void {
    this.layout.closeTabs(this.group().tabs);
  }

  protected onStripKey(event: KeyboardEvent): void {
    const tabs = this.group().tabs;
    const current = tabs.findIndex(t => t.equals(this.group().active));
    const key = event.ctrlKey || event.metaKey || event.altKey ? String.empty : event.key;
    const active = this.group().active;
    if (key === Resources.renameKey && !Object.isNull(active) && this.renames.canRename(active)) {
      event.preventDefault();
      this.renames.begin(active);
      return;
    }
    const tab = tabs[this.indexFor(key, current, tabs.length)];
    if (Object.isUndefined(tab))
      return;
    event.preventDefault();
    this.choose(tab);
  }

  private indexFor(key: string, current: number, count: number): number {
    switch (key) {
      case Resources.arrowLeftKey:
        return (current - 1 + count) % count;
      case Resources.arrowRightKey:
        return (current + 1) % count;
      case Resources.homeKey:
        return 0;
      case Resources.endKey:
        return count - 1;
      default:
        return -1;
    }
  }
}
