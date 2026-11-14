/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { chmod, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ExecutableLocator } from "../../../src/services/processes/executable-locator.js";
import { SourceTreeFixture } from "../../fixtures/source-tree.fixture.js";

@TestClass
export class ExecutableLocatorTests {
  @TestMethod
  public leavesTheNameToWindowsToFind(): void {
    Assert.areEqual("git", ExecutableLocator.locate("git", "win32", "/usr/bin"));
  }

  @TestMethod
  public async findsTheFirstExecutableFileInAnAbsoluteFolderOfThePath(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync({ "second/sample-tool": "", "relative/sample-tool": "" });
    await mkdir(path.join(tree.path, "first", "sample-tool"), { recursive: true });
    await chmod(path.join(tree.path, "second", "sample-tool"), 0o755);
    const searchPath = ["relative", path.join(tree.path, "missing"), path.join(tree.path, "first"), path.join(tree.path, "second")].join(path.delimiter);

    Assert.areEqual(path.join(tree.path, "second", "sample-tool"), ExecutableLocator.locate("sample-tool", "linux", searchPath));
  }

  @TestMethod
  public async leavesANameThatNoFolderHoldsAsItIs(): Promise<void> {
    await using tree = await SourceTreeFixture.createAsync();
    await writeFile(path.join(tree.path, "README.md"), "# Tools");

    Assert.areEqual("sample-tool", ExecutableLocator.locate("sample-tool", "linux", tree.path));
    Assert.areEqual("no-such-tool-for-this-test", ExecutableLocator.locate("no-such-tool-for-this-test"));
  }

  @TestMethod
  public leavesTheNameAsItIsWhenTheEnvironmentHasNoPath(): void {
    const saved = process.env["PATH"];
    delete process.env["PATH"];
    let located: string;
    try {
      located = ExecutableLocator.locate("sample-tool", "linux");
    }
    finally {
      if (!Object.isUndefined(saved))
        process.env["PATH"] = saved;
    }

    Assert.areEqual("sample-tool", located);
  }

  @TestMethod
  public passesOnAFailureOtherThanAnUnreachableFile(): void {
    Assert.throws(() => ExecutableLocator.locate("sample\u0000tool", "linux", path.resolve("tools")), Error);
  }
}
