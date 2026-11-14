/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { FilePathChoice } from "@noldova/desktop.electron";

@TestClass
export class FilePathChoiceTests {
  @TestMethod
  public readsAnyFileFromWhereTheSystemStartsUnlessTheOptionsSayOtherwise(): void {
    const plain = FilePathChoice.read({});
    const chosen = FilePathChoice.read({ extensions: ["exe", "CMD", "7z"], folder: "/opt/tools" });

    Assert.areEqual(JSON.stringify([[], null]), JSON.stringify([plain?.extensions, plain?.folder]));
    Assert.areEqual(JSON.stringify([["exe", "CMD", "7z"], "/opt/tools"]), JSON.stringify([chosen?.extensions, chosen?.folder]));
  }

  @TestMethod
  @TestData(null)
  @TestData([])
  @TestData("exe")
  @TestData({ extensions: [] })
  @TestData({ extensions: "exe" })
  @TestData({ extensions: [".exe"] })
  @TestData({ extensions: ["tar.gz"] })
  @TestData({ extensions: ["e x e"] })
  @TestData({ extensions: ["abcdefghijklmnopq"] })
  @TestData({ extensions: [5] })
  @TestData({ extensions: Array.from({ length: 33 }, (_, index) => `e${index}`) })
  @TestData({ folder: "tools" })
  @TestData({ folder: String.empty })
  @TestData({ folder: 5 })
  @TestData({ folder: "/opt/tools\u0007" })
  public refusesOptionsOutsideTheLimits(options: unknown): void {
    Assert.isNull(FilePathChoice.read(options));
  }

  @TestMethod
  public takesUpToThirtyTwoExtensionsOfUpToSixteenCharacters(): void {
    const extensions = Array.from({ length: 32 }, (_, index) => `${"e".repeat(15)}${index % 10}`);

    Assert.areEqual(32, FilePathChoice.read({ extensions })?.extensions.length);
  }
}
