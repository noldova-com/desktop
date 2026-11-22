/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class SettingColumns {
  public readonly name: string;
  public readonly scopeName: string;
  public readonly scopeId: string;
  public readonly device: string;

  public constructor(name: string, scopeName: string, scopeId: string, device: string) {
    this.name = name;
    this.scopeName = scopeName;
    this.scopeId = scopeId;
    this.device = device;
  }

  public get values(): readonly string[] {
    return [this.name, this.scopeName, this.scopeId, this.device];
  }
}
