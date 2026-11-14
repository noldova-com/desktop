/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import { ImageSize } from "../../src/models/image-size.js";

@TestClass
export class ImageSizeTests {
  @TestMethod
  public measuresItsLongEdgeAndPixels(): void {
    const size = new ImageSize(640, 1_200);

    Assert.areEqual(640, size.width);
    Assert.areEqual(1_200, size.height);
    Assert.areEqual(1_200, size.longEdge);
    Assert.areEqual(768_000, size.pixels);
  }

  @TestMethod
  public takesTheWidthAsTheLongEdgeOfAWideImage(): void {
    Assert.areEqual(1_920, new ImageSize(1_920, 1_080).longEdge);
  }
}
