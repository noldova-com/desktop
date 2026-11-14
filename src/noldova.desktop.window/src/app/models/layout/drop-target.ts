/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { Bounds } from "./bounds.js";
import type { Layout } from "./layout.js";
import type { LayoutGeometry } from "./layout-geometry.js";
import type { Tab } from "./tab.js";

export abstract class DropTarget {
  public abstract place(layout: Layout, tab: Tab): Layout;

  public abstract preview(geometry: LayoutGeometry): Bounds | null;

  public abstract equals(other: DropTarget | null): boolean;
}
