/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { SourceLiteral } from "../../../src/models/structure/source-literal.js";

@TestClass
export class SourceLiteralTests {
  @TestMethod
  public keepsTheValueAndItsLine(): void {
    const literal = new SourceLiteral("node:fs", 9);

    Assert.areEqual("node:fs:9", `${literal.value}:${literal.line}`);
  }
}
