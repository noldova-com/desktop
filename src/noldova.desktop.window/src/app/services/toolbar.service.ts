/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Injectable, type Signal, computed, inject } from "@angular/core";

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.js";
import { ToolbarMove } from "../enums/toolbar-move.js";
import { MenuItem } from "../models/menu-item.js";
import type { MenuPlace } from "../models/menu-place.js";
import { Toolbar } from "../models/toolbar.js";
import { LayoutService } from "./layout.service.js";
import { MenuService } from "./menu.service.js";

@Injectable({ providedIn: "root" })
export class ToolbarService {
  private readonly layout: LayoutService = inject(LayoutService);
  private readonly menus: MenuService = inject(MenuService);

  public readonly places: Signal<readonly MenuPlace[]> = computed(() => this.menus.active().flatMap(t => t.places).filter(t => !Object.isNull(t.toolbar)));
  public readonly shown: Signal<readonly string[]> = computed(() => this.arrangementOf(null).flat());
  public readonly rows: Signal<readonly (readonly Toolbar[])[]> = computed(() => this.rowsOf(null, {}));
  public readonly hasContent: Signal<boolean> = computed(() => this.rows().some(row => row.some(t => t.sections.length > 0)));

  public constructor() {
    this.menus.provideGroup(Resources.toolbarListGroup, context => this.placesOf(ToolbarService.bandIn(context))
      .map(t => MenuItem.ofCommand(Resources.toggleToolbarCommand, { [Resources.toolbarArgument]: t.name }, t.title)));
  }

  public bandOf(name: string): string | null {
    return this.places().find(t => t.name === name)?.toolbar?.band ?? null;
  }

  public arrangementOf(band: string | null): readonly (readonly string[])[] {
    return this.layout.layout().toolbarsOf(band).shownRows(this.placesOf(band));
  }

  public rowsOf(band: string | null, context: JsonObject): readonly (readonly Toolbar[])[] {
    return this.arrangementOf(band).map(row => row.flatMap(name => this.toolbarsOf(name, context)));
  }

  public isShown(name: string): boolean {
    return this.arrangementOf(this.bandOf(name)).some(t => t.includes(name));
  }

  public isKnown(name: string): boolean {
    return this.places().some(t => t.name === name);
  }

  public setShown(name: string, isShown: boolean): void {
    const band = this.bandOf(name);
    const toolbars = this.layout.layout().toolbarsOf(band);
    this.layout.setToolbars(isShown ? toolbars.show(name, this.placesOf(band)) : toolbars.hide(name, this.placesOf(band)), band);
  }

  public move(name: string, row: number, index: number): void {
    const band = this.bandOf(name);
    this.layout.setToolbars(this.layout.layout().toolbarsOf(band).move(name, row, index, this.placesOf(band)), band);
  }

  public moveToNewRow(name: string, row: number): void {
    const band = this.bandOf(name);
    this.layout.setToolbars(this.layout.layout().toolbarsOf(band).moveToNewRow(name, row, this.placesOf(band)), band);
  }

  public canMove(name: string, move: ToolbarMove): boolean {
    return !Object.isNull(this.destination(name, move));
  }

  public moveBy(name: string, move: ToolbarMove): void {
    const destination = this.destination(name, move);
    if (Object.isNull(destination))
      return;
    if (destination.isNewRow)
      this.moveToNewRow(name, destination.row);
    else
      this.move(name, destination.row, destination.index);
  }

  private destination(name: string, move: ToolbarMove): { readonly row: number; readonly index: number; readonly isNewRow: boolean } | null {
    const rows = this.arrangementOf(this.bandOf(name));
    const row = rows.findIndex(t => t.includes(name));
    const current = rows[row] ?? [];
    const index = current.indexOf(name);
    const into = (target: number): { readonly row: number; readonly index: number; readonly isNewRow: boolean } =>
      ({ row: target, index: Math.min(index, rows.slice(target, target + 1).flat().length), isNewRow: false });
    const alone = current.length < 2;
    switch (move) {
      case ToolbarMove.Left:
        return index > 0 ? { row, index: index - 1, isNewRow: false } : null;
      case ToolbarMove.Right:
        return index >= 0 && index < current.length - 1 ? { row, index: index + 1, isNewRow: false } : null;
      case ToolbarMove.Up:
        return row > 0 ? into(row - 1) : row === 0 && !alone ? { row: 0, index: 0, isNewRow: true } : null;
      case ToolbarMove.Down:
        return row >= 0 && row < rows.length - 1 ? into(row + 1) : row >= 0 && !alone ? { row: rows.length, index: 0, isNewRow: true } : null;
    }
  }

  private placesOf(band: string | null): readonly MenuPlace[] {
    return this.places().filter(t => (t.toolbar?.band ?? null) === band);
  }

  private toolbarsOf(name: string, context: JsonObject): readonly Toolbar[] {
    return this.places().filter(t => t.name === name).map(t => new Toolbar(t.name, t.title, this.menus.resolve(t.name, context)));
  }

  private static bandIn(context: JsonObject): string | null {
    const band = context[Resources.bandArgument];
    return Object.isString(band) ? band : null;
  }
}
