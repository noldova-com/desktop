/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { ICliSecrets } from "@noldova/desktop.cli";
import { Fake } from "@noldova/desktop.protocol/testing";

export class FakeCliSecretsFixture extends Fake<ICliSecrets> implements ICliSecrets {
  public readonly saveAsync: ICliSecrets["saveAsync"] = (...args) => this.respondAsync("saveAsync", args, this.answers.saveAsync);
  public readonly removeAsync: ICliSecrets["removeAsync"] = (...args) => this.respondAsync("removeAsync", args, this.answers.removeAsync);
  public readonly isSetAsync: ICliSecrets["isSetAsync"] = (...args) => this.respondAsync("isSetAsync", args, this.answers.isSetAsync);
}
