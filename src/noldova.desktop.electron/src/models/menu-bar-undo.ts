/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonReader } from "@noldova/context.json";

import { Resources } from "../resources.js";

export class MenuBarUndo {
  public readonly id: string;
  public readonly isEnabled: boolean;

  private constructor(id: string, isEnabled: boolean) {
    this.id = id;
    this.isEnabled = isEnabled;
  }

  public static fromJson(json: JsonReader): MenuBarUndo {
    return new MenuBarUndo(json.readNonBlankString(Resources.idField), json.readBoolean(Resources.enabledField));
  }
}
