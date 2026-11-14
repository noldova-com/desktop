/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ImageSize } from "../../models/image-size.js";
import { Resources } from "../../resources.js";
import { ImageSizeResources } from "./image-size.resources.js";

export class ImageSizeReader {
  public read(bytes: Buffer, mimeType: string | null): ImageSize | null {
    const size = mimeType === Resources.pngMimeType ? ImageSizeReader.readPng(bytes) : ImageSizeReader.readJpeg(bytes);
    return Object.isNull(size) || size.width === 0 || size.height === 0 ? null : size;
  }

  private static readPng(bytes: Buffer): ImageSize | null {
    const isPng = bytes.length >= ImageSizeResources.pngHeaderEnd
      && bytes.subarray(0, ImageSizeResources.pngSignature.length).equals(ImageSizeResources.pngSignature)
      && bytes.toString(ImageSizeResources.pngHeaderEncoding, ImageSizeResources.pngHeaderStart, ImageSizeResources.pngWidthOffset) === ImageSizeResources.pngHeader;
    return isPng ? new ImageSize(bytes.readUInt32BE(ImageSizeResources.pngWidthOffset), bytes.readUInt32BE(ImageSizeResources.pngHeightOffset)) : null;
  }

  private static readJpeg(bytes: Buffer): ImageSize | null {
    if (bytes.length < ImageSizeResources.markerLength || bytes[0] !== ImageSizeResources.marker || bytes[1] !== ImageSizeResources.jpegStart)
      return null;
    let offset = ImageSizeResources.markerLength;
    while (offset + ImageSizeResources.frameEnd <= bytes.length && bytes[offset] === ImageSizeResources.marker) {
      if (ImageSizeResources.frameMarkers.includes(bytes.readUInt8(offset + 1)))
        return new ImageSize(bytes.readUInt16BE(offset + ImageSizeResources.frameWidthOffset), bytes.readUInt16BE(offset + ImageSizeResources.frameHeightOffset));
      offset += ImageSizeResources.markerLength + bytes.readUInt16BE(offset + ImageSizeResources.markerLength);
    }
    return null;
  }
}
