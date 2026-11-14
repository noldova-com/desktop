/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";
import { PackagedPath } from "@noldova/desktop.runtime";

@TestClass
export class PackagedPathTests {
  @TestMethod
  @TestData("/Applications/Sample.app/Contents/Resources/app.asar/node_modules/sample/jxa/script.js",
    "/Applications/Sample.app/Contents/Resources/app.asar.unpacked/node_modules/sample/jxa/script.js")
  @TestData("C:\\Program Files\\Sample\\resources\\app.asar\\node_modules\\sample\\jxa\\script.js",
    "C:\\Program Files\\Sample\\resources\\app.asar.unpacked\\node_modules\\sample\\jxa\\script.js")
  @TestData("C:/Program Files/Sample/resources/app.asar/node_modules/sample/jxa/script.js",
    "C:/Program Files/Sample/resources/app.asar.unpacked/node_modules/sample/jxa/script.js")
  @TestData("/tmp/.mount_Sample/resources/app.asar", "/tmp/.mount_Sample/resources/app.asar.unpacked")
  @TestData("app.asar/sample/script.js", "app.asar.unpacked/sample/script.js")
  public givesTheUnpackedCopyOfAFileInsideTheArchiveWithEitherSeparator(file: string, unpacked: string): void {
    Assert.areEqual(unpacked, PackagedPath.unpacked(file));
  }

  @TestMethod
  public changesOnlyTheFirstArchiveSegment(): void {
    Assert.areEqual("/app/resources/app.asar.unpacked/node_modules/inner/app.asar/script.js", PackagedPath.unpacked("/app/resources/app.asar/node_modules/inner/app.asar/script.js"));
  }

  @TestMethod
  @TestData("/Applications/Sample.app/Contents/Resources/app.asar.unpacked/node_modules/sample/jxa/script.js")
  @TestData("C:\\Program Files\\Sample\\resources\\app.asar.unpacked\\node_modules\\sample\\script.js")
  @TestData("/home/person/sample/node_modules/sample/jxa/script.js")
  @TestData("/home/person/my.app.asar.d/script.js")
  @TestData("/home/person/app.asar.d/script.js")
  @TestData("/home/person/myapp.asar/script.js")
  @TestData("C:\\sample\\my-app.asar\\script.js")
  @TestData("/home/person/app.asarx/script.js")
  @TestData(String.empty)
  public leavesAPathWithNoWholeArchiveSegmentAsItIs(file: string): void {
    Assert.areEqual(file, PackagedPath.unpacked(file));
  }
}
