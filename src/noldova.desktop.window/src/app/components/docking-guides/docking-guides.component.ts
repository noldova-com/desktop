/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, computed, inject } from "@angular/core";

import "@noldova/context.core";
import { DockingDirection, DockingGuideComponent, DockingPlateComponent } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.js";
import { BottomDockSpan } from "../../enums/bottom-dock-span.js";
import { DockSide } from "../../enums/dock-side.js";
import type { Bounds } from "../../models/layout/bounds.js";
import { DockingOverlay } from "../../models/layout/docking-overlay.js";
import { GroupDropTarget } from "../../models/layout/group-drop-target.js";
import type { GroupFrame } from "../../models/layout/group-frame.js";
import { SideDropTarget } from "../../models/layout/side-drop-target.js";
import { SplitDropTarget } from "../../models/layout/split-drop-target.js";
import { LayoutService } from "../../services/layout.service.js";
import { TabDragService } from "../../services/tab-drag.service.js";
import { TabLabelService } from "../../services/tab-label.service.js";

@Component({
  selector: "nol-docking-guides",
  imports: [DockingGuideComponent, DockingPlateComponent],
  templateUrl: "./docking-guides.component.html",
  styleUrl: "./docking-guides.component.css"
})
export class DockingGuidesComponent {
  private readonly layout: LayoutService = inject(LayoutService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly drag: TabDragService = inject(TabDragService);
  protected readonly labels: TabLabelService = inject(TabLabelService);
  protected readonly sides: readonly DockSide[] = Object.values(DockSide);
  protected readonly overlay: Signal<DockingOverlay> = computed(() => new DockingOverlay(this.layout.geometry()));
  protected readonly preview: Signal<Bounds | null> = computed(() => this.drag.target()?.preview(this.layout.geometry()) ?? null);
  protected readonly plateFrame: Signal<GroupFrame | null> = computed(() => {
    const tab = this.drag.dragging();
    const id = this.drag.hoveredGroup();
    const frame = Object.isNull(id) ? null : this.layout.geometry().frameOf(id);
    if (Object.isNull(tab) || Object.isNull(frame) || !this.layout.layout().canSplit(tab, frame.group.id))
      return null;
    return frame;
  });

  protected readonly outerTarget: SideDropTarget = new SideDropTarget(DockSide.Bottom, BottomDockSpan.Full);

  protected targetOf(side: DockSide): SideDropTarget {
    return new SideDropTarget(side, side === DockSide.Bottom ? BottomDockSpan.Between : null);
  }

  protected isChosen(target: SideDropTarget): boolean {
    return target.equals(this.drag.target());
  }

  protected plateChoice(frame: GroupFrame): DockingDirection | null {
    const target = this.drag.target();
    if (target instanceof SplitDropTarget)
      return Resources.edgeDirections[target.edge];
    return new GroupDropTarget(frame.group.id).equals(target) ? DockingDirection.Center : null;
  }
}
