/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { Resources } from "../../resources.ts";
import type { ToolbarPlacement } from "./toolbar-placement.ts";

export class MenuPlace {
  public readonly name: string;
  public readonly title: string;
  public readonly isMenuBar: boolean;
  public readonly toolbar: ToolbarPlacement | null;

  public constructor(name: string, title: string, isMenuBar: boolean, toolbar: ToolbarPlacement | null = null) {
    this.name = name;
    this.title = title;
    this.isMenuBar = isMenuBar;
    this.toolbar = toolbar;
  }

  public toJson(): Readonly<Record<string, unknown>> {
    if (!Object.isNull(this.toolbar))
      return { name: this.name, title: this.title, shows: Resources.menuShowsToolbar, ...this.toolbar.toJson() };
    return { name: this.name, title: this.title, shows: this.isMenuBar ? Resources.menuShowsMenuBar : Resources.menuShowsMenu };
  }
}
