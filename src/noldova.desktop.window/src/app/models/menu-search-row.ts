/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IconName } from "@noldova/ui.components.angular";

import { KnownIcon } from "./known-icon.js";

export class MenuSearchRow {
  public readonly id: string;
  public readonly title: string;
  public readonly icon: IconName | null;
  public readonly menu: string;

  public constructor(id: string, title: string, icon: string | null, menu: string) {
    this.id = id;
    this.title = title;
    this.icon = KnownIcon.of(icon);
    this.menu = menu;
  }
}
