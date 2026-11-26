/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { type IconName, IconNames } from "@noldova/ui.components.angular";

export class KnownIcon {
  private static readonly NAMES: ReadonlySet<string> = new Set(IconNames.all);

  public static isKnown(name: string): name is IconName {
    return KnownIcon.NAMES.has(name);
  }

  public static of(name: string | null): IconName | null {
    return !Object.isNull(name) && KnownIcon.isKnown(name) ? name : null;
  }
}
