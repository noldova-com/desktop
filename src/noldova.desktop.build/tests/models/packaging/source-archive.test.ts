/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { SourceArchive } from "../../../src/models/packaging/source-archive.js";

@TestClass
export class SourceArchiveTests {
  private static readonly URL: string = "https://example.com/releases/download/sources-1/sample-2.0-source.tar";
  private static readonly SHA256: string = "0123456789abcdef".repeat(4);

  @TestMethod
  public readsAnHttpsAddressItsSizeAndItsSha256(): void {
    const archive = SourceArchive.parse({ url: SourceArchiveTests.URL, size: 874387968, sha256: SourceArchiveTests.SHA256 });

    Assert.areEqual(`{"url":"${SourceArchiveTests.URL}","size":874387968,"sha256":"${SourceArchiveTests.SHA256}"}`, JSON.stringify(archive));
    Assert.areEqual("sample-2.0-source.tar", archive?.fileName);
    Assert.areEqual(JSON.stringify(archive?.toJson()), JSON.stringify(archive));
  }

  @TestMethod
  public readsNoOtherShape(): void {
    const valid = { url: SourceArchiveTests.URL, size: 10, sha256: SourceArchiveTests.SHA256 };
    const values: unknown[] = [
      null,
      [valid],
      SourceArchiveTests.URL,
      { url: SourceArchiveTests.URL, size: 10 },
      { ...valid, extra: 1 },
      { ...valid, url: "http://example.com/releases/sample-source.tar" },
      { ...valid, url: "https://example.com/releases/" },
      { ...valid, url: "https://example.com/releases/sample%20source.tar" },
      { ...valid, url: "https://example.com/releases/.sample-source.tar" },
      { ...valid, url: "sample-source.tar" },
      { ...valid, url: 1 },
      { ...valid, size: 0 },
      { ...valid, size: 1.5 },
      { ...valid, size: "10" },
      { ...valid, sha256: SourceArchiveTests.SHA256.toUpperCase() },
      { ...valid, sha256: SourceArchiveTests.SHA256.slice(1) },
      { ...valid, sha256: 1 }
    ];

    for (const value of values)
      Assert.isNull(SourceArchive.parse(value), JSON.stringify(value));
  }

  @TestMethod
  public isTheSameOnlyWithTheSameAddressSizeAndSha256(): void {
    const archive = new SourceArchive(SourceArchiveTests.URL, 10, SourceArchiveTests.SHA256);

    Assert.isTrue(archive.isSame(new SourceArchive(SourceArchiveTests.URL, 10, SourceArchiveTests.SHA256)));
    Assert.isFalse(archive.isSame(new SourceArchive(`${SourceArchiveTests.URL}.gz`, 10, SourceArchiveTests.SHA256)));
    Assert.isFalse(archive.isSame(new SourceArchive(SourceArchiveTests.URL, 11, SourceArchiveTests.SHA256)));
    Assert.isFalse(archive.isSame(new SourceArchive(SourceArchiveTests.URL, 10, "f".repeat(64))));
  }
}
