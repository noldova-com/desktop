/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { BuildVariant } from "../../../src/models/modules/build-variant.js";

@TestClass
export class BuildVariantTests {
  @TestMethod
  public buildsTheRegularVariantWithoutTestsFixturesPackagingOrAFeed(): void {
    const variant = BuildVariant.REGULAR;

    Assert.areEqual("false||false|null", [variant.isTest, variant.excluded.join(","), variant.isPackaged, String(variant.updateFeed)].join("|"));
  }

  @TestMethod
  public keepsWhatItIsGiven(): void {
    const variant = new BuildVariant(true, ["notes"], true, "https://example.com/feed/");

    Assert.areEqual("true|notes|true|https://example.com/feed/", [variant.isTest, variant.excluded.join(","), variant.isPackaged, variant.updateFeed].join("|"));
  }
}
