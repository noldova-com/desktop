/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../../../resources.js";
import type { DockSide } from "../../enums/dock-side.js";
import type { PanelEdge } from "../../enums/panel-edge.js";
import type { SplitAxis } from "../../enums/split-axis.js";
import type { Bounds } from "./bounds.js";
import type { GroupFrame } from "./group-frame.js";
import type { LayoutMetrics } from "./layout-metrics.js";
import type { SplitHandle } from "./split-handle.js";
import type { SplitNode } from "./split.node.js";
import type { TabGroup } from "./tab-group.js";
import type { ViewRegistry } from "./view-registry.js";

export abstract class LayoutNode {
  public readonly id: number;

  protected constructor(id: number) {
    if (!Number.isInteger(id) || id < 0)
      throw new ArgumentOutOfRangeException(Resources.idParameterName, id);

    this.id = id;
  }

  public abstract get groups(): readonly TabGroup[];

  public abstract get nodeIds(): readonly number[];

  public abstract get cornerGroup(): TabGroup;

  public abstract minimumLength(axis: SplitAxis, metrics: LayoutMetrics): number;

  public abstract withGroup(group: TabGroup): LayoutNode;

  public abstract withoutGroup(id: number): LayoutNode | null;

  public abstract splitGroup(id: number, added: TabGroup, edge: PanelEdge, splitId: number): LayoutNode;

  public abstract withSplit(split: SplitNode): LayoutNode;

  public abstract withVisibleTabs(registry: ViewRegistry): LayoutNode | null;

  public abstract arrange(bounds: Bounds, side: DockSide | null, frames: GroupFrame[], handles: SplitHandle[], metrics: LayoutMetrics): void;

  public abstract toJson(): JsonObject;
}
