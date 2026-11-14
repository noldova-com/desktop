/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, type Signal, computed, inject, input } from "@angular/core";

import { AppearanceService, SashComponent, SashOrientation } from "@noldova/ui.components.angular";

import { Resources } from "../../../resources.js";
import { SplitAxis } from "../../enums/split-axis.js";
import type { SplitHandle } from "../../models/layout/split-handle.js";
import { LayoutService } from "../../services/layout.service.js";

@Component({
  selector: "nol-split-sash",
  imports: [SashComponent],
  templateUrl: "./split-sash.component.html",
  styleUrl: "./split-sash.component.css",
  host: {
    "[attr.data-split]": "handle().split.id",
    "[attr.data-index]": "handle().index",
    "[style.left.rem]": "handle().bounds.x",
    "[style.top.rem]": "handle().bounds.y",
    "[style.width.rem]": "handle().bounds.width",
    "[style.height.rem]": "handle().bounds.height"
  }
})
export class SplitSashComponent {
  private readonly appearance: AppearanceService = inject(AppearanceService);
  private readonly layout: LayoutService = inject(LayoutService);

  protected readonly resources: typeof Resources = Resources;
  protected readonly orientation: Signal<SashOrientation> = computed(() => this.handle().split.axis === SplitAxis.Horizontal ? SashOrientation.Vertical : SashOrientation.Horizontal);
  protected readonly value: Signal<number> = computed(() => this.pixels(this.handle().leadingLength));

  public readonly handle = input.required<SplitHandle>();

  protected pixels(length: number): number {
    return Math.round(length * this.appearance.typography().rootSize);
  }

  protected resize(delta: number): void {
    this.layout.resizeSplit(this.handle(), this.handle().leadingLength + delta / this.appearance.typography().rootSize);
  }
}
