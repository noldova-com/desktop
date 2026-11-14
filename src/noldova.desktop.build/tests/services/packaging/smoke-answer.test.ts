/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { SmokeAnswer } from "../../../src/services/packaging/smoke-answer.js";

@TestClass
export class SmokeAnswerTests {
  @TestMethod
  public readsWhatTheAnswerHolds(): void {
    Assert.areEqual("1.2.0", SmokeAnswer.read("{\"version\":\"1.2.0\"}", t => t.readString("version")));
  }

  @TestMethod
  @TestData("not JSON")
  @TestData("{\"version\":12}")
  @TestData("{}")
  public readsNothingFromAnAnswerThatIsNotJsonOrLacksWhatIsRead(text: string): void {
    Assert.isNull(SmokeAnswer.read(text, t => t.readString("version")));
  }

  @TestMethod
  public throwsWhatItsReadThrowsWhenThatIsNotAJsonFailure(): void {
    const error = Assert.throws(() => SmokeAnswer.read("{}", () => {
      throw new TypeError("A bug in the read.");
    }), TypeError);

    Assert.areEqual("A bug in the read.", error.message);
  }
}
