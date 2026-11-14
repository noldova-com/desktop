/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { CliOptionType } from "../../src/enums/cli-option-type.js";

@TestClass
export class CliOptionTypeTests {
  @TestMethod
  public namesEveryTypeByItsMember(): void {
    Assert.areEqual("Text,Number,Boolean", Object.values(CliOptionType).join(","));
  }
}
