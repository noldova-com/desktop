/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { DockSide } from "../../enums/dock-side.js";
import type { Layout } from "./layout.js";
import type { LayoutMetrics } from "./layout-metrics.js";
import type { ViewRegistry } from "./view-registry.js";

export class LayoutGeometrySource {
  public readonly width: number;
  public readonly height: number;
  public readonly layout: Layout;
  public readonly registry: ViewRegistry;
  public readonly metrics: LayoutMetrics | null;
  public readonly iconSides: ReadonlySet<DockSide>;
  public readonly kept: DockSide | null;
  public readonly wanted: number | null;

  public constructor(width: number, height: number, layout: Layout, registry: ViewRegistry, metrics: LayoutMetrics | null, iconSides: ReadonlySet<DockSide>, kept: DockSide | null,
    wanted: number | null) {
    this.width = width;
    this.height = height;
    this.layout = layout;
    this.registry = registry;
    this.metrics = metrics;
    this.iconSides = iconSides;
    this.kept = kept;
    this.wanted = wanted;
  }
}
