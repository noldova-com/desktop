/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { OfferedFile } from "@noldova/desktop.electron";

@TestClass
export class OfferedFileTests {
  private static readonly FILE: string = path.resolve("report.pdf");
  private static readonly OVER: number = 64 * 1024 * 1024 + 1;

  @TestMethod
  public readsADroppedFileByItsPathAPastedOneByItsBytesAndAPasteOverTheCallsLimitByItsSize(): void {
    const dropped = OfferedFile.read({ name: "Report.PDF", type: "Application/PDF", path: OfferedFileTests.FILE, size: 1204 });
    const pasted = OfferedFile.read({ name: "image.png", type: "image/png", bytes: new Uint8Array([1, 2]), size: 2 });
    const oversized = OfferedFile.read({ name: "clip.bin", type: String.empty, size: OfferedFileTests.OVER });
    const overCall = OfferedFile.read({ name: String.empty, type: String.empty, size: 1 });

    Assert.areEqual(`Report.PDF|application/pdf|${OfferedFileTests.FILE}|null|1204`, OfferedFileTests.describe(dropped));
    Assert.areEqual("image.png|image/png|null|1,2|2", OfferedFileTests.describe(pasted));
    Assert.areEqual(`clip.bin|application/octet-stream|null|null|${OfferedFileTests.OVER}`, OfferedFileTests.describe(oversized));
    Assert.areEqual("pasted|application/octet-stream|null|null|1", OfferedFileTests.describe(overCall));
  }

  @TestMethod
  public namesAFileThatHasNoUsableNameByItsPathOrAsPasted(): void {
    const long = "a".repeat(256);

    const names = [
      OfferedFile.read({ name: " ", type: String.empty, path: OfferedFileTests.FILE, size: 0 }),
      OfferedFile.read({ name: long, type: String.empty, path: OfferedFileTests.FILE, size: 0 }),
      OfferedFile.read({ name: String.empty, type: String.empty, bytes: new Uint8Array(0), size: 0 }),
      OfferedFile.ofPath(OfferedFileTests.FILE)
    ].map(t => `${t?.name}:${t?.mediaType}`);

    Assert.areEqual("report.pdf:application/octet-stream,report.pdf:application/octet-stream,pasted:application/octet-stream,report.pdf:application/octet-stream", names.join(","));
  }

  @TestMethod
  @TestData("text/plain; charset=utf-8")
  @TestData("image")
  @TestData("/png")
  @TestData("image/")
  public takesAnUnknownMediaTypeForOneThatIsNotATypeAndSubtype(type: string): void {
    Assert.areEqual("application/octet-stream", OfferedFile.read({ name: "a", type, bytes: new Uint8Array(0), size: 0 })?.mediaType);
  }

  @TestMethod
  @TestData(null)
  @TestData([])
  @TestData("report.pdf")
  @TestData({ type: String.empty, size: 0, bytes: [] })
  @TestData({ name: 1, type: String.empty, size: 0 })
  @TestData({ name: "a", size: 0 })
  @TestData({ name: "a", type: String.empty, size: "1" })
  @TestData({ name: "a", type: String.empty, size: 1.5 })
  @TestData({ name: "a", type: String.empty, size: -1 })
  @TestData({ name: "a", type: String.empty })
  @TestData({ name: "a", type: String.empty, path: "report.pdf", size: 0 })
  @TestData({ name: "a", type: String.empty, path: 5, size: 0 })
  @TestData({ name: "a", type: String.empty, bytes: [1], size: 1 })
  public refusesWhatIsNotAnOfferedFile(value: unknown): void {
    Assert.isNull(OfferedFile.read(value));
  }

  @TestMethod
  public refusesAPathWithBytesAndBytesOfAnotherSize(): void {
    Assert.isNull(OfferedFile.read({ name: "a", type: String.empty, path: OfferedFileTests.FILE, bytes: new Uint8Array(1), size: 1 }));
    Assert.isNull(OfferedFile.read({ name: "a", type: String.empty, bytes: new Uint8Array(2), size: 1 }));
  }

  private static describe(file: OfferedFile | null): string {
    if (Object.isNull(file))
      return "null";
    return `${file.name}|${file.mediaType}|${file.path}|${Object.isNull(file.bytes) ? null : Array.from(file.bytes).join(",")}|${file.size}`;
  }
}
