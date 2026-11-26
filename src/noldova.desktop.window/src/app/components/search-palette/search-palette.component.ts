/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Component, DestroyRef, ErrorHandler, type Signal, type WritableSignal, computed, inject, signal } from "@angular/core";

import "@noldova/context.core";
import { QuickInputComponent, QuickInputItem } from "@noldova/ui.components.angular";

import { KnownIcon } from "../../models/known-icon.js";
import type { SearchFilter } from "../../models/search-filter.js";
import type { SearchRow } from "../../models/search-row.js";
import type { SearchSession } from "../../models/search-session.js";
import type { TextRange } from "../../models/text-range.js";
import { SearchPaletteService } from "../../services/search-palette.service.js";
import { SearchService } from "../../services/search.service.js";
import { Resources } from "../../../resources.js";

@Component({
  selector: "nol-search-palette",
  imports: [QuickInputComponent],
  templateUrl: "./search-palette.component.html",
  styleUrl: "./search-palette.component.css"
})
export class SearchPaletteComponent {
  private readonly palette: SearchPaletteService = inject(SearchPaletteService);
  private readonly errors: ErrorHandler = inject(ErrorHandler);
  private readonly session: SearchSession = inject(SearchService).createSession();
  private readonly rows: Signal<ReadonlyMap<string, SearchRow>> = computed(() => new Map(this.session.groups().flatMap(t => t.rows).map(t => [t.id, t])));

  protected readonly resources: typeof Resources = Resources;
  protected readonly label: Signal<string> = inject(SearchService).placeholder;
  protected readonly query: WritableSignal<string> = signal(this.palette.request.query);
  protected readonly filters: Signal<readonly SearchFilter[]> = this.session.filters;
  protected readonly isSearching: Signal<boolean> = this.session.isSearching;
  protected readonly itemsQuery: Signal<string> = this.session.answeredText;
  protected readonly emptyText: Signal<string> = computed(() => this.session.query().isEmpty ? String.empty : Resources.nothingFound);
  protected readonly items: Signal<readonly QuickInputItem[]> = computed(() => this.session.groups().flatMap(group => group.rows.map((t, index) =>
    new QuickInputItem(t.id, t.result.title, KnownIcon.of(t.source.icon), t.result.detail, t.result.keyLabel, SearchPaletteComponent.indicesOf(t.result.titleMatch),
      SearchPaletteComponent.indicesOf(t.result.detailMatch), index === 0 ? group.heading : null))));

  public constructor() {
    this.session.choose(this.palette.request.source);
    this.session.search(this.query());
    inject(DestroyRef).onDestroy(() => this.session.close());
  }

  protected search(text: string): void {
    this.query.set(text);
    this.session.search(text);
  }

  protected choose(filter: SearchFilter): void {
    this.session.choose(filter.source);
  }

  protected moveFilter(event: KeyboardEvent): void {
    event.preventDefault();
    this.session.moveFilter(event.shiftKey ? -1 : 1);
  }

  protected open(item: QuickInputItem): void {
    const row = this.rows().get(item.id);
    this.palette.close();
    if (!Object.isUndefined(row))
      row.result.openAsync().catch((error: unknown) => this.errors.handleError(error));
  }

  protected close(): void {
    this.palette.close();
  }

  private static indicesOf(range: TextRange | null): readonly number[] {
    return Object.isNull(range) ? [] : Array.from({ length: range.length }, (_, t) => range.start + t);
  }
}
