/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ArgumentsSource } from "../../src/enums/arguments-source.js";

@TestClass
export class ArgumentsSourceTests {
  @TestMethod
  public namesEverySourceByItsMember(): void {
    Assert.areEqual("None,Inline,File,Input", Object.values(ArgumentsSource).join(","));
  }
}
