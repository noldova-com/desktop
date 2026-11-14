/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { TypeScriptCompiler } from "../../../src/services/toolchain/typescript-compiler.js";

@TestClass
export class TypeScriptCompilerTests {
  @TestMethod
  public findsTheCompilerOfTheTypeScriptTheFolderResolves(): void {
    const compiler = TypeScriptCompiler.locate(path.dirname(fileURLToPath(import.meta.url)));

    Assert.isTrue(compiler.endsWith(path.join("typescript", "bin", "tsc")), compiler);
    Assert.isTrue(existsSync(compiler), compiler);
  }
}
