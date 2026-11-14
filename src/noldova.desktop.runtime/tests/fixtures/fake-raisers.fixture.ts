/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import type { FakeModuleLog } from "@noldova/desktop.runtime/testing";

export class FakeRaisersFixture {
  public static readonly FAILURE: Error = new Error("The listener failed.");

  public static heard(listen: (listener: () => void) => () => void, raise: () => void): string {
    const heard: string[] = [];
    let stopRemoved = (): void => undefined;
    listen(() => stopRemoved());
    stopRemoved = listen(() => {
      heard.push("removed");
    });
    listen(() => {
      heard.push("third");
    });
    listen(() => {
      throw FakeRaisersFixture.FAILURE;
    });
    listen(() => {
      heard.push("fourth");
    });
    try {
      raise();
    } catch (error) {
      heard.push(error === FakeRaisersFixture.FAILURE ? "threw" : "threw another error");
    }
    return heard.join("|");
  }

  public static logged(log: FakeModuleLog, start: string): boolean {
    const lines = log.callsOf("write").map(([message]) => String(message));
    return lines.length === 1 && lines.every(t => t.startsWith(start) && t.includes(FakeRaisersFixture.FAILURE.message));
  }
}
