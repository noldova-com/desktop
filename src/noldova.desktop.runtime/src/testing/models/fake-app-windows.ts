/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IAppWindows } from "../../interfaces/i-app-windows.js";

export class FakeAppWindows extends Fake<IAppWindows> implements IAppWindows {
  private readonly changed: Set<() => void> = new Set<() => void>();

  public readonly list: IAppWindows["list"] = (...args) => this.ask("list", args, this.answers.list);
  public readonly onChanged: IAppWindows["onChanged"] = listener => this.listen("onChanged", [listener], this.changed, listener);

  public raiseChanged(): void {
    this.raiseLive(this.changed, t => t());
  }
}
