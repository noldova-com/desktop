/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TarFile } from "../../../src/models/packaging/tar-file.js";

@TestClass
export class TarFileTests {
  @TestMethod
  public keepsTheEntrysNameTypeContentAndMode(): void {
    const file = new TarFile("package/index.js", "0", Buffer.from("content"), 0o755);

    Assert.areEqual("package/index.js 0 content 493", `${file.name} ${file.type} ${file.content.toString("utf8")} ${file.mode}`);
  }
}
