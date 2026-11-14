/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ExtractedCopy } from "../../../src/services/packaging/extracted-copy.js";

@TestClass
export class ExtractedCopyTests {
  @TestMethod
  public async isPresentWhileItsRecordOrItsExtractionIsThere(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-extracted-copy-"));
    try {
      const record = path.join(folder, "copy.log");
      const extraction = path.join(folder, "extraction");
      const copy = new ExtractedCopy(record, extraction);
      await writeFile(record, "{}");
      await mkdir(extraction);

      const both = await copy.isPresentAsync();
      await rm(record);
      const extractionOnly = await copy.isPresentAsync();
      await rm(extraction, { recursive: true });
      const none = await copy.isPresentAsync();

      Assert.areEqual(`${record}|${extraction}`, copy.items.join("|"));
      Assert.areEqual("true true false", [both, extractionOnly, none].join(" "));
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }

  @TestMethod
  public async leavesItsCopyAloneWhenTheMainProcessEndsOrIsKilled(): Promise<void> {
    const folder = await mkdtemp(path.join(tmpdir(), "desktop-extracted-copy-"));
    try {
      const record = path.join(folder, "copy.log");
      const copy = new ExtractedCopy(record, path.join(folder, "extraction"));
      await writeFile(record, "{}");

      await copy.requireOutlivesAsync();
      await copy.checkKilledAsync();

      Assert.isTrue(await copy.isPresentAsync());
    }
    finally {
      await rm(folder, { recursive: true, force: true });
    }
  }
}
