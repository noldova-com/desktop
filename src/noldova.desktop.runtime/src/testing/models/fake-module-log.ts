/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IModuleLog } from "../../interfaces/i-module-log.js";

export class FakeModuleLog extends Fake<IModuleLog> implements IModuleLog {
  public readonly write: IModuleLog["write"] = (...args) => this.tell("write", args, this.answers.write);
}
