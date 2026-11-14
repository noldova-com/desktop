/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IWindowSecrets } from "../../app/interfaces/i-window-secrets.js";

export class FakeWindowSecrets extends Fake<IWindowSecrets> implements IWindowSecrets {
  public readonly saveAsync: IWindowSecrets["saveAsync"] = (...args) => this.respondAsync("saveAsync", args, this.answers.saveAsync);
  public readonly removeAsync: IWindowSecrets["removeAsync"] = (...args) => this.respondAsync("removeAsync", args, this.answers.removeAsync);
  public readonly isSetAsync: IWindowSecrets["isSetAsync"] = (...args) => this.respondAsync("isSetAsync", args, this.answers.isSetAsync);
}
