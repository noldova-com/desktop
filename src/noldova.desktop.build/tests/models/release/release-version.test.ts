/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestData, TestMethod } from "@noldova/context.testing";

import { BuildException } from "../../../src/exceptions/build.exception.js";
import { ReleaseVersion } from "../../../src/models/release/release-version.js";

@TestClass
export class ReleaseVersionTests {
  @TestMethod
  public readsAPlainVersionAndItsTag(): void {
    const version = ReleaseVersion.parse("1.20.3", "RELEASE_VERSION");

    Assert.areEqual("1.20.3", version.text);
    Assert.areEqual("v1.20.3", version.tag);
  }

  @TestMethod
  @TestData("1.2")
  @TestData("01.2.3")
  @TestData("1.2.3-beta.1")
  @TestData("v1.2.3")
  public refusesAVersionThatIsNotPlain(text: string): void {
    const error = Assert.throws(() => ReleaseVersion.parse(text, "RELEASE_VERSION"), BuildException);

    Assert.areEqual(`RELEASE_VERSION must be a plain version such as 0.0.2, not "${text}".`, error.message);
  }

  @TestMethod
  public readsATagAndRefusesOneWithoutItsPrefix(): void {
    const version = ReleaseVersion.parseTag("v0.0.2", "The latest release");
    const error = Assert.throws(() => ReleaseVersion.parseTag("0.0.2", "The latest release"), BuildException);
    const inner = Assert.throws(() => ReleaseVersion.parseTag("vnext", "The latest release"), BuildException);

    Assert.areEqual("0.0.2", version.text);
    Assert.areEqual("The latest release must be a tag such as v0.0.2, not \"0.0.2\".", error.message);
    Assert.areEqual("The latest release must be a plain version such as 0.0.2, not \"next\".", inner.message);
  }

  @TestMethod
  @TestData("2.0.0", "1.9.9", true)
  @TestData("1.9.9", "2.0.0", false)
  @TestData("1.3.0", "1.2.9", true)
  @TestData("1.2.9", "1.3.0", false)
  @TestData("1.2.4", "1.2.3", true)
  @TestData("1.2.3", "1.2.3", false)
  @TestData("1.10.0", "1.9.0", true)
  public comparesByMajorThenMinorThenPatch(first: string, second: string, isNewer: boolean): void {
    Assert.areEqual(isNewer, ReleaseVersion.parse(first, "first").isNewerThan(ReleaseVersion.parse(second, "second")));
  }
}
