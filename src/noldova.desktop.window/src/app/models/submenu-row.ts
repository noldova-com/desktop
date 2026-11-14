/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonObject } from "@noldova/context.json";

import { MenuRow } from "./menu-row.js";

export class SubmenuRow extends MenuRow {
  public readonly isSubmenu: true = true;
  public readonly place: string;
  public readonly context: JsonObject;

  public constructor(place: string, title: string, icon: string | null = null, context: JsonObject = {}) {
    super(title, icon);

    this.place = place;
    this.context = context;
  }
}
