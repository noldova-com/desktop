/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { DOCUMENT } from "@angular/common";
import { Injectable, Injector, type Signal, type WritableSignal, inject, signal } from "@angular/core";

import "@noldova/context.core";

import { SearchPaletteComponent } from "../components/search-palette/search-palette.component.js";
import { SearchRequest } from "../models/search-request.js";
import type { WindowPalette } from "../models/window-palette.js";
import { WindowRowOverlayService } from "./window-row-overlay.service.js";
import { Resources } from "../../resources.js";

@Injectable({ providedIn: "root" })
export class SearchPaletteService {
  private readonly injector: Injector = inject(Injector);
  private readonly document: Document = inject(DOCUMENT);
  private readonly overlays: WindowRowOverlayService = inject(WindowRowOverlayService);
  private readonly openValue: WritableSignal<boolean> = signal(false);
  private palette: WindowPalette<SearchPaletteComponent> | null = null;

  public readonly isShown: Signal<boolean> = this.openValue.asReadonly();
  public request: SearchRequest = SearchRequest.plain;

  public get isOpen(): boolean {
    return this.palette?.isOpen ?? false;
  }

  public open(request: SearchRequest = SearchRequest.plain): void {
    if (this.isOpen)
      return;
    this.overlays.closeOpen();
    this.request = request;
    const margin = this.measureMargin();
    const palette = this.overlays.open(SearchPaletteComponent, this.injector, Resources.searchPaneClass, row => SearchPaletteService.fieldTop(row) - margin);
    if (Object.isNull(palette))
      return;
    this.palette = palette;
    this.openValue.set(true);
    void palette.closed.then(() => {
      if (this.palette === palette) {
        this.palette = null;
        this.openValue.set(false);
      }
    });
  }

  public close(): void {
    this.palette?.close();
  }

  private measureMargin(): number {
    const probe = this.document.body.appendChild(this.document.createElement(Resources.divElement));
    probe.style.cssText = Resources.searchMarginProbeStyle;
    const margin = probe.getBoundingClientRect().height;
    probe.remove();
    return margin;
  }

  private static fieldTop(row: Element): number {
    return (row.querySelector(Resources.searchFieldSelector) ?? row).getBoundingClientRect().top;
  }
}
