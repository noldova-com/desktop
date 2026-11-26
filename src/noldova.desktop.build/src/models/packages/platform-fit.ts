/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import type { JsonObject } from "@noldova/context.json";

import { Resources } from "../../resources.ts";

export class PlatformFit {
  public static fits(entry: JsonObject, platform: string, architecture: string): boolean {
    return PlatformFit.allows(entry[Resources.lockfileOsField], platform)
      && PlatformFit.allows(entry[Resources.lockfileCpuField], architecture)
      && (platform !== Resources.lockfileLinuxPlatform || PlatformFit.allows(entry[Resources.lockfileLibcField], Resources.lockfileLinuxLibrary));
  }

  private static allows(field: unknown, value: string): boolean {
    const list: readonly unknown[] = Object.isString(field) ? [field] : Array.isArray(field) ? field : [];
    if (list.includes(`${Resources.lockfileNegation}${value}`))
      return false;
    const required = list.filter(t => Object.isString(t) && !t.startsWith(Resources.lockfileNegation));
    return required.length === 0 || required.includes(value);
  }
}
