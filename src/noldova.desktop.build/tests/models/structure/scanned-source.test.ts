/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ScannedSource } from "../../../src/models/structure/scanned-source.js";
import { SourceLiteral } from "../../../src/models/structure/source-literal.js";

@TestClass
export class ScannedSourceTests {
  @TestMethod
  public keepsWhatTheScanFound(): void {
    const scanned = new ScannedSource([new SourceLiteral("node:fs", 1)], [new SourceLiteral("app-root", 2)], [new SourceLiteral("Hello", 3)], [4], true);

    Assert.areEqual("node:fs|app-root|Hello|4|true",
      [scanned.imports.map(t => t.value).join(), scanned.selectors.map(t => t.value).join(), scanned.texts.map(t => t.value).join(), scanned.comments.join(), scanned.hasFunctionBody].join("|"));
  }
}
