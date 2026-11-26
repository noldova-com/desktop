/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { JsonReader } from "@noldova/context.json";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { PlatformFit } from "../../../src/models/packages/platform-fit.js";

@TestClass
export class PlatformFitTests {
  @TestMethod
  @TestData("{}", "linux", "x64", true)
  @TestData("{\"os\":[\"linux\"]}", "linux", "x64", true)
  @TestData("{\"os\":[\"darwin\",\"win32\"]}", "linux", "x64", false)
  @TestData("{\"os\":[\"!linux\"]}", "linux", "x64", false)
  @TestData("{\"os\":[\"!win32\"]}", "linux", "x64", true)
  @TestData("{\"cpu\":[\"arm64\"]}", "darwin", "arm64", true)
  @TestData("{\"cpu\":[\"x64\"]}", "darwin", "arm64", false)
  @TestData("{\"cpu\":[\"!arm64\"]}", "darwin", "arm64", false)
  public async fitsAnEntryWhoseOsAndCpuListsTakeThePlatformAndArchitecture(entry: string, platform: string, architecture: string, expected: boolean): Promise<void> {
    Assert.areEqual(expected, PlatformFit.fits(JsonReader.parse(entry).toJson(), platform, architecture));
  }

  @TestMethod
  @TestData("{\"libc\":[\"glibc\"]}", "linux", true)
  @TestData("{\"libc\":[\"musl\"]}", "linux", false)
  @TestData("{\"libc\":[\"!glibc\"]}", "linux", false)
  @TestData("{\"libc\":[\"musl\"]}", "win32", true)
  public async takesTheGlibcLibraryOnLinuxAndNoLibraryElsewhere(entry: string, platform: string, expected: boolean): Promise<void> {
    Assert.areEqual(expected, PlatformFit.fits(JsonReader.parse(entry).toJson(), platform, "x64"));
  }

  @TestMethod
  @TestData("{\"libc\":\"musl\"}", "linux", "x64", false)
  @TestData("{\"libc\":\"glibc\"}", "linux", "x64", true)
  @TestData("{\"os\":\"darwin\"}", "linux", "x64", false)
  @TestData("{\"cpu\":\"!x64\"}", "linux", "x64", false)
  @TestData("{\"cpu\":5}", "linux", "x64", true)
  public async takesAFieldWrittenAsOneTextAsAListOfIt(entry: string, platform: string, architecture: string, expected: boolean): Promise<void> {
    Assert.areEqual(expected, PlatformFit.fits(JsonReader.parse(entry).toJson(), platform, architecture));
  }
}
