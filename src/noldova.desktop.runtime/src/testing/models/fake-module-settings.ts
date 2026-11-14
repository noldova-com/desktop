/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { SettingChange } from "@noldova/desktop.protocol";
import { Fake } from "@noldova/desktop.protocol/testing";

import type { IModuleSettings } from "../../interfaces/i-module-settings.js";

export class FakeModuleSettings extends Fake<IModuleSettings> implements IModuleSettings {
  private readonly changed: Set<{ readonly name: string; readonly listener: (change: SettingChange) => void }> = new Set<{ readonly name: string; readonly listener: (change: SettingChange) => void }>();

  public readonly read: IModuleSettings["read"] = (...args) => this.ask("read", args, this.answers.read);
  public readonly write: IModuleSettings["write"] = (...args) => this.tell("write", args, this.answers.write);
  public readonly reset: IModuleSettings["reset"] = (...args) => this.tell("reset", args, this.answers.reset);
  public readonly onChanged: IModuleSettings["onChanged"] = (name, listener) => {
    this.listen("onChanged", [name, listener], this.changed, { name, listener });
  };
  public readonly setScopeParent: IModuleSettings["setScopeParent"] = (...args) => this.tell("setScopeParent", args, this.answers.setScopeParent);
  public readonly removeScope: IModuleSettings["removeScope"] = (...args) => this.tell("removeScope", args, this.answers.removeScope);

  public raiseChanged(name: string, change: SettingChange): void {
    this.raise(this.changed, t => t.name === name && t.listener(change));
  }
}
