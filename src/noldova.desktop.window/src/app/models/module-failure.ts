/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ModuleState } from "@noldova/desktop.protocol";

import { Resources } from "../../resources.js";

export class ModuleFailure {
  public readonly moduleId: string;
  public readonly displayName: string;
  public readonly state: ModuleState;
  public readonly cause: string | null;
  public readonly viewNames: readonly string[];
  public readonly documentNames: readonly string[];
  public readonly switchSetting: string | null;
  public readonly isTurnedOff: boolean;

  public constructor(
    moduleId: string, displayName: string, state: ModuleState, cause: string | null, viewNames: readonly string[], documentNames: readonly string[] = [],
    switchSetting: string | null = null, isTurnedOff: boolean = false) {
    this.moduleId = moduleId;
    this.displayName = displayName;
    this.state = state;
    this.cause = cause;
    this.viewNames = [...viewNames];
    this.documentNames = [...documentNames];
    this.switchSetting = switchSetting;
    this.isTurnedOff = isTurnedOff;
  }

  public get glyph(): string {
    if (this.state === ModuleState.Unavailable)
      return Resources.moduleUnavailableGlyph;
    return this.isTurnedOff ? Resources.moduleOffGlyph : Resources.moduleFailureGlyph;
  }
}
