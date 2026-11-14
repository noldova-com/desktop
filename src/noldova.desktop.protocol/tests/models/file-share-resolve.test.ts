/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { FileShareResolve } from "@noldova/desktop.protocol";

@TestClass
export class FileShareResolveTests {
  private static readonly GRANT: string = "8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21";

  @TestMethod
  public pinsItsWireForm(): void {
    Assert.areEqual(`{"grant":"${FileShareResolveTests.GRANT}"}`, JSON.stringify(new FileShareResolve(FileShareResolveTests.GRANT).toJson()));
    Assert.areEqual(FileShareResolveTests.GRANT, FileShareResolve.fromJson({ grant: FileShareResolveTests.GRANT }).grant);
  }

  @TestMethod
  @TestData(String.empty)
  @TestData("8C1F0A3E9B2D4C6F8E0A1B3C5D7E9F21")
  @TestData("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f2")
  @TestData("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21/")
  @TestData("../8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f")
  public refusesAGrantThatIsNotThirtyTwoLowercaseHexDigits(grant: string): void {
    Assert.throws(() => new FileShareResolve(grant), ArgumentException);
    Assert.areEqual("$.grant", Assert.throws(() => FileShareResolve.fromJson({ grant }), JsonException).path);
  }

  @TestMethod
  public refusesAMissingGrantAndUnknownFields(): void {
    Assert.areEqual("$.grant", Assert.throws(() => FileShareResolve.fromJson({}), JsonException).path);
    Assert.areEqual("$.path", Assert.throws(() => FileShareResolve.fromJson({ grant: FileShareResolveTests.GRANT, path: "/etc/hosts" }), JsonException).path);
  }
}
