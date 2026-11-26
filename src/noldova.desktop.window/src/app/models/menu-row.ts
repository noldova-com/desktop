/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { IconName } from "@noldova/ui.components.angular";

import { KnownIcon } from "./known-icon.js";

export abstract class MenuRow {
  public readonly title: string;
  public readonly icon: IconName | null;

  protected constructor(title: string, icon: string | null) {
    this.title = title;
    this.icon = KnownIcon.of(icon);
  }
}
