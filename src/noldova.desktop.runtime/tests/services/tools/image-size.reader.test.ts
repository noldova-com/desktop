/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";
import { Assert, TestClass, TestMethod } from "@noldova/context.testing";

import type { ImageSize } from "../../../src/models/image-size.js";
import { ImageSizeReader } from "../../../src/services/tools/image-size.reader.js";
import { ToolImageFixture } from "../../fixtures/tool-image.fixture.js";

@TestClass
export class ImageSizeReaderTests {
  private static readonly PNG: string = "image/png";
  private static readonly JPEG: string = "image/jpeg";

  @TestMethod
  public readsAPngsSizeFromItsHeader(): void {
    const size = new ImageSizeReader().read(ImageSizeReaderTests.decode(ToolImageFixture.png(640, 480)), ImageSizeReaderTests.PNG);

    Assert.areEqual("640x480", ImageSizeReaderTests.describe(size));
  }

  @TestMethod
  public readsAJpegsSizeFromItsFirstFrameAfterSkippingOtherSegments(): void {
    const size = new ImageSizeReader().read(ImageSizeReaderTests.decode(ToolImageFixture.jpeg(1_024, 768)), ImageSizeReaderTests.JPEG);

    Assert.areEqual("1024x768", ImageSizeReaderTests.describe(size));
  }

  @TestMethod
  public readsAnyTypeButPngAsAJpeg(): void {
    const reader = new ImageSizeReader();
    const jpeg = ImageSizeReaderTests.decode(ToolImageFixture.jpeg(32, 16));

    const untyped = reader.read(jpeg, null);
    const asPng = reader.read(jpeg, ImageSizeReaderTests.PNG);

    Assert.areEqual("32x16", ImageSizeReaderTests.describe(untyped));
    Assert.isNull(asPng);
  }

  @TestMethod
  public findsNoSizeInBytesThatAreNotTheImageTheyClaimToBe(): void {
    const reader = new ImageSizeReader();
    const png = ImageSizeReaderTests.decode(ToolImageFixture.png(640, 480));

    Assert.isNull(reader.read(ImageSizeReaderTests.decode(ToolImageFixture.png(640, 480, "IDAT")), ImageSizeReaderTests.PNG));
    Assert.isNull(reader.read(png.subarray(0, 23), ImageSizeReaderTests.PNG));
    Assert.isNull(reader.read(png, ImageSizeReaderTests.JPEG));
    Assert.isNull(reader.read(Buffer.from([0xff]), ImageSizeReaderTests.JPEG));
    Assert.isNull(reader.read(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00]), ImageSizeReaderTests.JPEG));
    Assert.isNull(reader.read(Buffer.from([0xff, 0xd8, 0x00, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x10, 0x00, 0x20]), ImageSizeReaderTests.JPEG));
  }

  @TestMethod
  public findsNoSizeInAnImageWithAnEmptyEdge(): void {
    const reader = new ImageSizeReader();

    Assert.isNull(reader.read(ImageSizeReaderTests.decode(ToolImageFixture.png(0, 480)), ImageSizeReaderTests.PNG));
    Assert.isNull(reader.read(ImageSizeReaderTests.decode(ToolImageFixture.jpeg(32, 0)), ImageSizeReaderTests.JPEG));
  }

  private static describe(size: ImageSize | null): string {
    return Object.isNull(size) ? "none" : `${size.width}x${size.height}`;
  }

  private static decode(value: string): Buffer {
    return Buffer.from(value, "base64");
  }
}
