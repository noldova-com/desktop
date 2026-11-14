/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

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
}
