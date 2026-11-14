/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IModuleSecrets } from "../../interfaces/i-module-secrets.js";

export class FakeModuleSecrets extends Fake<IModuleSecrets> implements IModuleSecrets {
  public readonly saveAsync: IModuleSecrets["saveAsync"] = (...args) => this.respondAsync("saveAsync", args, this.answers.saveAsync);
  public readonly readAsync: IModuleSecrets["readAsync"] = (...args) => this.respondAsync("readAsync", args, this.answers.readAsync);
  public readonly removeAsync: IModuleSecrets["removeAsync"] = (...args) => this.respondAsync("removeAsync", args, this.answers.removeAsync);
  public readonly isSetAsync: IModuleSecrets["isSetAsync"] = (...args) => this.respondAsync("isSetAsync", args, this.answers.isSetAsync);
}
