/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { JsonValue } from "@noldova/context.json";
import type { ICliCommandConsole } from "@noldova/desktop.cli";
import { Fake } from "@noldova/desktop.protocol/testing";

export class FakeCliCommandConsoleFixture extends Fake<ICliCommandConsole> implements ICliCommandConsole {
  private readonly events: Set<{ readonly name: string; readonly listener: (payload: JsonValue) => void }> = new Set<{ readonly name: string; readonly listener: (payload: JsonValue) => void }>();

  public readonly writeLine: ICliCommandConsole["writeLine"] = (...args) => this.tell("writeLine", args, this.answers.writeLine);
  public readonly askAsync: ICliCommandConsole["askAsync"] = (...args) => this.respondAsync("askAsync", args, this.answers.askAsync);
  public readonly onEvent: ICliCommandConsole["onEvent"] = (name, listener) => ({ [Symbol.dispose]: this.listen("onEvent", [name, listener], this.events, { name, listener }) });

  public raiseEvent(name: string, payload: JsonValue): void {
    this.raise(this.events, t => t.name === name && t.listener(payload));
  }
}
