/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { SourceFile } from "../../../src/models/packaging/source-file.js";

@TestClass
export class SourceFileTests {
  private static readonly URL: string = "https://example.com/sources/sample-2.0.tar.gz";
  private static readonly SHA256: string = "0123456789abcdef".repeat(4);

  @TestMethod
  public readsAnHttpsAddressItsSizeAndItsSha256(): void {
    const file = SourceFile.parse({ url: SourceFileTests.URL, size: 874387968, sha256: SourceFileTests.SHA256 });

    Assert.areEqual(`{"url":"${SourceFileTests.URL}","size":874387968,"sha256":"${SourceFileTests.SHA256}"}`, JSON.stringify(file));
  }

  @TestMethod
  public readsNoOtherShape(): void {
    const valid = { url: SourceFileTests.URL, size: 10, sha256: SourceFileTests.SHA256 };
    const values: unknown[] = [
      null,
      [valid],
      SourceFileTests.URL,
      { url: SourceFileTests.URL, size: 10 },
      { ...valid, extra: 1 },
      { ...valid, url: "http://example.com/sources/sample-2.0.tar.gz" },
      { ...valid, url: "sample-2.0.tar.gz" },
      { ...valid, url: 1 },
      { ...valid, size: 0 },
      { ...valid, size: 1.5 },
      { ...valid, size: "10" },
      { ...valid, sha256: SourceFileTests.SHA256.toUpperCase() },
      { ...valid, sha256: SourceFileTests.SHA256.slice(1) },
      { ...valid, sha256: 1 }
    ];

    for (const value of values)
      Assert.isNull(SourceFile.parse(value), JSON.stringify(value));
  }

  @TestMethod
  public takesOnlyAnHttpsAddressAsAnAddress(): void {
    Assert.isTrue(SourceFile.isAddress("https://example.com/sample/releases/tag/v1.0.0"));
    for (const value of ["http://example.com/sample", "example.com/sample", "https://", 1, null])
      Assert.isFalse(SourceFile.isAddress(value), String(value));
  }
}
