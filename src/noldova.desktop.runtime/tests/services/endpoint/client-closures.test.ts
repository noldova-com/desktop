/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { ClientClosure, ClientClosures, type Registration } from "@noldova/desktop.runtime";

import { TextOutputFixture } from "../../fixtures/text-output.fixture.js";

@TestClass
export class ClientClosuresTests {
  @TestMethod
  public callsEachListenerAtOnceInOrderAndLogsTheOnesThatFail(): Promise<void> {
    const diagnostics = new TextOutputFixture();
    const closures = new ClientClosures(diagnostics);
    const heard: string[] = [];
    closures.listen(() => {
      throw new Error("first broke");
    });
    closures.listen(t => {
      heard.push(`second ${t.connection}:${t.window}`);
    });
    closures.listen(() => Promise.reject(new Error("third broke")));
    closures.listen(t => {
      heard.push(`fourth ${t.connection}:${t.window}`);
    });

    closures.report(new ClientClosure(2, 5));
    closures.report(new ClientClosure(2, null));

    Assert.areEqual("second 2:5|fourth 2:5|second 2:null|fourth 2:null", heard.join("|"));
    return new Promise<void>(resolve => setImmediate(resolve)).then(() => Assert.areEqual(
      [
        "A part failed to hear that connection 2 closed: Error: first broke",
        "A part failed to hear that connection 2 closed: Error: third broke",
        "A part failed to hear that window 5 of connection 2 closed: Error: first broke",
        "A part failed to hear that window 5 of connection 2 closed: Error: third broke"
      ].join("|"),
      diagnostics.text.split("\n").filter(t => t.length > 0).sort().join("|")));
  }

  @TestMethod
  public stopsCallingAListenerOnceItsRegistrationIsDisposed(): void {
    const closures = new ClientClosures(new TextOutputFixture());
    const heard: string[] = [];
    let second: Registration | null = null;
    const first = closures.listen(() => {
      heard.push("first");
      second?.[Symbol.dispose]();
    });
    second = closures.listen(() => {
      heard.push("second");
    });

    closures.report(new ClientClosure(1, null));
    first[Symbol.dispose]();
    closures.report(new ClientClosure(1, null));

    Assert.areEqual("first", heard.join("|"));
  }
}
