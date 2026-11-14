/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Fake } from "@noldova/desktop.protocol/testing";

import type { IModuleDatabase } from "../../interfaces/i-module-database.js";

export class FakeModuleDatabase extends Fake<IModuleDatabase> implements IModuleDatabase {
  public readonly read: IModuleDatabase["read"] = (...args) => this.ask("read", args, this.answers.read);
  public readonly readAll: IModuleDatabase["readAll"] = (...args) => this.ask("readAll", args, this.answers.readAll);
  public readonly run: IModuleDatabase["run"] = (...args) => this.ask("run", args, this.answers.run);

  public transaction<T>(action: () => T & ([T] extends [PromiseLike<unknown>] ? never : unknown)): T {
    return this.answerOf("transaction", [action], this.answers.transaction)<T>(action);
  }
}
