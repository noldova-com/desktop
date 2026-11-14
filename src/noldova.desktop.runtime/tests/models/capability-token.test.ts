/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { CapabilityToken } from "@noldova/desktop.runtime";

@TestClass
export class CapabilityTokenTests {
  @TestMethod
  public generatesThirtyTwoRandomBytesAsHex(): void {
    const first = CapabilityToken.generate();
    const second = CapabilityToken.generate();

    Assert.isTrue(/^[0-9a-f]{64}$/.test(first.value));
    Assert.areNotEqual(first.value, second.value);
  }

  @TestMethod
  public matchesOnlyItsOwnValue(): void {
    const token = new CapabilityToken("secret");

    Assert.isTrue(token.matches("secret"));
    Assert.isFalse(token.matches("secreT"));
    Assert.isFalse(token.matches("secret "));
    Assert.isFalse(token.matches(String.empty));
  }

  @TestMethod
  public requiresAValue(): void {
    const exception = Assert.throws(() => new CapabilityToken(" "), ArgumentException);

    Assert.areEqual("token", exception.parameterName);
  }
}
