/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ArgumentException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";
import { FileGrantsDiscard } from "@noldova/desktop.protocol";

@TestClass
export class FileGrantsDiscardTests {
  private static readonly FIRST: string = "8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21";
  private static readonly SECOND: string = "0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f54";

  @TestMethod
  public pinsItsWireFormAndKeepsItsOwnCopy(): void {
    const grants = [FileGrantsDiscardTests.FIRST, FileGrantsDiscardTests.SECOND];
    const discard = new FileGrantsDiscard(grants);
    grants.pop();

    Assert.areEqual(`{"grants":["${FileGrantsDiscardTests.FIRST}","${FileGrantsDiscardTests.SECOND}"]}`, JSON.stringify(discard.toJson()));
    Assert.areEqual(2, FileGrantsDiscard.fromJson(discard.toJson()).grants.length);
  }

  @TestMethod
  public takesTheMostItAllows(): void {
    const grants = Array.from({ length: 256 }, (_, t) => t.toString(16).padStart(32, "0"));

    Assert.areEqual(256, new FileGrantsDiscard(grants).grants.length);
    Assert.areEqual(256, FileGrantsDiscard.maximumGrants);
    Assert.throws(() => new FileGrantsDiscard([...grants, "f".repeat(32)]), ArgumentException);
  }

  @TestMethod
  public refusesNoneARepeatAndAGrantThatBreaksItsRule(): void {
    Assert.throws(() => new FileGrantsDiscard([]), ArgumentException);
    Assert.throws(() => new FileGrantsDiscard([FileGrantsDiscardTests.FIRST, FileGrantsDiscardTests.FIRST]), ArgumentException);
    Assert.areEqual("$.grants", Assert.throws(() => FileGrantsDiscard.fromJson({ grants: ["notes.txt"] }), JsonException).path);
  }

  @TestMethod
  public refusesAMissingListAndUnknownFields(): void {
    Assert.areEqual("$.grants", Assert.throws(() => FileGrantsDiscard.fromJson({}), JsonException).path);
    Assert.areEqual("$.window", Assert.throws(() => FileGrantsDiscard.fromJson({ grants: [FileGrantsDiscardTests.FIRST], window: 3 }), JsonException).path);
  }
}
