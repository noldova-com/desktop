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

export class ImageSizeReader {
  public read(bytes: Buffer, mimeType: string | null): ImageSize | null {
    const size = mimeType === Resources.pngMimeType ? ImageSizeReader.readPng(bytes) : ImageSizeReader.readJpeg(bytes);
    return Object.isNull(size) || size.width === 0 || size.height === 0 ? null : size;
  }

  private static readPng(bytes: Buffer): ImageSize | null {
    const isPng = bytes.length >= Resources.pngHeaderEnd
      && bytes.subarray(0, Resources.pngSignature.length).equals(Resources.pngSignature)
      && bytes.toString(Resources.pngHeaderEncoding, Resources.pngHeaderStart, Resources.pngWidthOffset) === Resources.pngHeader;
    return isPng ? new ImageSize(bytes.readUInt32BE(Resources.pngWidthOffset), bytes.readUInt32BE(Resources.pngHeightOffset)) : null;
  }

  private static readJpeg(bytes: Buffer): ImageSize | null {
    if (bytes.length < Resources.jpegMarkerLength || bytes[0] !== Resources.jpegMarkerPrefix || bytes[1] !== Resources.jpegStartMarker)
      return null;
    let offset = Resources.jpegMarkerLength;
    while (offset + Resources.jpegFrameEnd <= bytes.length && bytes[offset] === Resources.jpegMarkerPrefix) {
      if (Resources.jpegFrameMarkers.includes(bytes.readUInt8(offset + 1)))
        return new ImageSize(bytes.readUInt16BE(offset + Resources.jpegFrameWidthOffset), bytes.readUInt16BE(offset + Resources.jpegFrameHeightOffset));
      offset += Resources.jpegMarkerLength + bytes.readUInt16BE(offset + Resources.jpegMarkerLength);
    }
    return null;
  }
}
