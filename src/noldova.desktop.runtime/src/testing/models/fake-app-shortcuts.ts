/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IAppShortcuts } from "../../interfaces/i-app-shortcuts.js";

export class FakeAppShortcuts extends Fake<IAppShortcuts> implements IAppShortcuts {
  private readonly changed: Set<() => void> = new Set<() => void>();

  public readonly list: IAppShortcuts["list"] = (...args) => this.ask("list", args, this.answers.list);
  public readonly has: IAppShortcuts["has"] = (...args) => this.ask("has", args, this.answers.has);
  public readonly onChanged: IAppShortcuts["onChanged"] = listener => this.listen("onChanged", [listener], this.changed, listener);

  public raiseChanged(): void {
    this.raiseLive(this.changed, t => t());
  }
}
