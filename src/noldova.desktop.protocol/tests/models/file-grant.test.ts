/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { ArgumentException, ArgumentOutOfRangeException } from "@noldova/context.exceptions";
import { JsonException } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { FileGrant } from "@noldova/desktop.protocol";

@TestClass
export class FileGrantTests {
  private static readonly GRANT: string = "8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21";

  @TestMethod
  public pinsItsWireForm(): void {
    const grant = FileGrantTests.create();

    Assert.areEqual(
      "{\"grant\":\"8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21\",\"path\":\"/home/person/notes.txt\",\"name\":\"notes.txt\",\"mediaType\":\"text/plain\",\"size\":1204,"
      + "\"identity\":\"66306:1311:1204:1761600000000000000\",\"module\":\"notes\",\"window\":3,\"page\":2,\"lifetime\":600000,\"staged\":true}",
      JSON.stringify(grant.toJson()));
    Assert.areEqual(JSON.stringify(grant.toJson()), JSON.stringify(FileGrant.fromJson(grant.toJson()).toJson()));
    Assert.isTrue(FileGrant.fromJson(grant.toJson()).isStaged);
  }

  @TestMethod
  @TestData("8C1F0A3E9B2D4C6F8E0A1B3C5D7E9F21")
  @TestData("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f2")
  @TestData("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9f21a")
  @TestData("8c1f0a3e9b2d4c6f8e0a1b3c5d7e9fzz")
  public refusesAGrantThatIsNot32LowercaseHexDigits(grant: string): void {
    Assert.areEqual("grant", Assert.throws(() => FileGrantTests.create({ grant }), ArgumentException).parameterName);
  }

  @TestMethod
  @TestData("path")
  @TestData("name")
  @TestData("mediaType")
  @TestData("identity")
  public namesABlankText(field: string): void {
    Assert.areEqual(`$.${field}`, Assert.throws(() => FileGrant.fromJson({ ...FileGrantTests.create().toJson(), [field]: " " }), JsonException).path);
  }

  @TestMethod
  @TestData("size", -1)
  @TestData("size", 1.5)
  @TestData("window", 0)
  @TestData("page", 0)
  @TestData("page", 2.5)
  @TestData("lifetime", 0)
  @TestData("lifetime", 600_001)
  public refusesANumberOutOfItsRange(field: string, value: number): void {
    Assert.throws(() => FileGrantTests.create({}, { [field]: value }), ArgumentOutOfRangeException);
    Assert.areEqual(`$.${field}`, Assert.throws(() => FileGrant.fromJson({ ...FileGrantTests.create().toJson(), [field]: value }), JsonException).path);
  }

  @TestMethod
  @TestData("desktop")
  @TestData("Notes")
  @TestData(String.empty)
  public refusesAModuleThatIsNotAModuleId(module: string): void {
    Assert.areEqual("module", Assert.throws(() => FileGrantTests.create({ module }), ArgumentException).parameterName);
  }

  @TestMethod
  public takesAnEmptyFileAndTheLongestLifetime(): void {
    const grant = FileGrantTests.create({}, { size: 0, lifetime: 600_000 }, false);

    Assert.areEqual("0,600000,false", `${grant.size},${grant.lifetime},${grant.isStaged}`);
    Assert.areEqual(600_000, FileGrant.maximumLifetime);
  }

  @TestMethod
  public refusesAMissingFieldAndUnknownFields(): void {
    const json = FileGrantTests.create().toJson();
    const { staged: _staged, ...withoutStaged } = json;

    Assert.areEqual("$.staged", Assert.throws(() => FileGrant.fromJson(withoutStaged), JsonException).path);
    Assert.areEqual("$.bytes", Assert.throws(() => FileGrant.fromJson({ ...json, bytes: String.empty }), JsonException).path);
  }

  private static create(texts: Readonly<Record<string, string>> = {}, numbers: Readonly<Record<string, number>> = {}, isStaged: boolean = true): FileGrant {
    return new FileGrant(texts["grant"] ?? FileGrantTests.GRANT, "/home/person/notes.txt", "notes.txt", "text/plain", numbers["size"] ?? 1_204,
      "66306:1311:1204:1761600000000000000", texts["module"] ?? "notes", numbers["window"] ?? 3, numbers["page"] ?? 2, numbers["lifetime"] ?? 600_000, isStaged);
  }
}
