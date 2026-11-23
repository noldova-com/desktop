/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../../../resources.js";
import type { DockSide } from "../../enums/dock-side.js";
import type { SplitAxis } from "../../enums/split-axis.js";
import type { LayoutMetrics } from "./layout-metrics.js";
import type { LayoutNode } from "./layout.node.js";
import type { ViewRegistry } from "./view-registry.js";

export class Dock {
  public readonly side: DockSide;
  public readonly root: LayoutNode | null;
  public readonly size: number | null;
  public readonly isCollapsed: boolean;

  public constructor(side: DockSide, root: LayoutNode | null, size: number | null, isCollapsed: boolean) {
    if (!Object.isNull(size) && !(Number.isFinite(size) && size >= 0))
      throw new ArgumentOutOfRangeException(Resources.sizeParameterName, size, Resources.invalidSize);

    this.side = side;
    this.root = root;
    this.size = size;
    this.isCollapsed = isCollapsed;
  }

  public static createEmpty(side: DockSide): Dock {
    return new Dock(side, null, null, false);
  }

  public get axis(): SplitAxis {
    return Resources.edgeAxes[Resources.dockEdges[this.side]];
  }

  public get isExpanded(): boolean {
    return !Object.isNull(this.root) && !this.isCollapsed;
  }

  public minimumSize(metrics: LayoutMetrics): number {
    return Math.max(metrics.dockMinimum, this.groupsMinimumSize(metrics));
  }

  public groupsMinimumSize(metrics: LayoutMetrics): number {
    return this.root?.minimumLength(this.axis, metrics) ?? 0;
  }

  public preferredSize(metrics: LayoutMetrics, length: number = Number.POSITIVE_INFINITY): number {
    const full = Resources.dockFullSizeLengths[this.side];
    const fallback = metrics.dockSizes[this.side];
    return this.size ?? (Object.isNull(full) ? fallback : fallback * Math.min(1, length / full));
  }

  public preferredTrack(metrics: LayoutMetrics, length: number = Number.POSITIVE_INFINITY): number {
    if (Object.isNull(this.root))
      return 0;
    if (this.isCollapsed)
      return metrics.strip + metrics.gap;
    return Math.max(this.preferredSize(metrics, length), this.minimumSize(metrics)) + metrics.gap;
  }

  public holds(groupId: number): boolean {
    return this.root?.groups.some(t => t.id === groupId) ?? false;
  }

  public withRoot(root: LayoutNode | null): Dock {
    return root === this.root ? this : new Dock(this.side, root, this.size, this.isCollapsed);
  }

  public withSize(size: number | null): Dock {
    return size === this.size ? this : new Dock(this.side, this.root, size, this.isCollapsed);
  }

  public withCollapsed(isCollapsed: boolean): Dock {
    return isCollapsed === this.isCollapsed ? this : new Dock(this.side, this.root, this.size, isCollapsed);
  }

  public withVisibleTabs(registry: ViewRegistry): Dock {
    return this.withRoot(this.root?.withVisibleTabs(registry) ?? null);
  }

  public toJson(): JsonObject {
    return { [Resources.rootField]: this.root?.toJson() ?? null, [Resources.sizeField]: this.size, [Resources.collapsedField]: this.isCollapsed };
  }
}
