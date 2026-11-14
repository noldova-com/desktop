/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { Resources } from "../../resources.js";
import { ClipboardImageResources } from "./clipboard-image.resources.js";

export class ClipboardImage {
  public static async readAsync(bytes: Uint8Array): Promise<Uint8Array | null> {
    if (bytes.byteLength > Resources.imageCopyByteLimit)
      return null;
    const size = ClipboardImage.sizeOf(bytes);
    if (Object.isNull(size) || !ClipboardImage.fits(size[0], size[1]))
      return null;
    if (ClipboardImage.matches(bytes, 0, Resources.pngSignature))
      return bytes;
    try {
      return await ClipboardImage.toPngAsync(bytes);
    }
    catch {
      return null;
    }
  }

  private static async toPngAsync(bytes: Uint8Array): Promise<Uint8Array | null> {
    const bitmap = await createImageBitmap(new Blob([bytes.slice()]));
    try {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext(Resources.imageCanvasContext);
      if (Object.isNull(context))
        return null;
      context.drawImage(bitmap, 0, 0);
      const png = await canvas.convertToBlob({ type: Resources.copiedImageType });
      return new Uint8Array(await png.arrayBuffer());
    }
    finally {
      bitmap.close();
    }
  }

  private static fits(width: number, height: number): boolean {
    return width > 0 && height > 0 && width <= Resources.imageCopySideLimit && height <= Resources.imageCopySideLimit &&
      width * height <= Resources.imageCopyPixelLimit;
  }

  private static sizeOf(bytes: Uint8Array): readonly [number, number] | null {
    if (ClipboardImage.matches(bytes, 0, Resources.pngSignature))
      return ClipboardImage.matches(bytes, ClipboardImageResources.pngHeaderChunkOffset, Resources.pngHeaderChunk) && bytes.byteLength > ClipboardImageResources.pngHeaderLength
        ? [ClipboardImage.readUint32(bytes, ClipboardImageResources.pngWidthOffset), ClipboardImage.readUint32(bytes, ClipboardImageResources.pngHeightOffset)] : null;
    if (ClipboardImage.matches(bytes, 0, Resources.jpegSignature))
      return ClipboardImage.jpegSizeOf(bytes);
    if (Resources.gifSignatures.some(t => ClipboardImage.matches(bytes, 0, t)))
      return ClipboardImage.gifSizeOf(bytes);
    if (ClipboardImage.matches(bytes, 0, Resources.webpSignature))
      return ClipboardImage.webpSizeOf(bytes);
    return null;
  }

  private static jpegSizeOf(bytes: Uint8Array): readonly [number, number] | null {
    let offset = ClipboardImageResources.jpegFirstMarkerOffset;
    while (offset + ClipboardImageResources.jpegMarkerLookahead < bytes.byteLength && bytes[offset] === ClipboardImageResources.jpegMarkerPrefix) {
      const marker = ClipboardImage.view(bytes).getUint8(offset + 1);
      if (marker === ClipboardImageResources.jpegMarkerPrefix)
        offset += 1;
      else if (Resources.jpegEndMarkers.includes(marker))
        return null;
      else if (Resources.jpegStandaloneMarkers.includes(marker))
        offset += ClipboardImageResources.jpegMarkerLength;
      else if (Resources.jpegFrameMarkers.includes(marker))
        return offset + ClipboardImageResources.jpegFrameLength <= bytes.byteLength
          ? [ClipboardImage.readUint16(bytes, offset + ClipboardImageResources.jpegFrameWidthOffset), ClipboardImage.readUint16(bytes, offset + ClipboardImageResources.jpegFrameHeightOffset)]
          : null;
      else
        offset += ClipboardImageResources.jpegMarkerLength + ClipboardImage.readUint16(bytes, offset + ClipboardImageResources.jpegMarkerLength);
    }
    return null;
  }

  private static gifSizeOf(bytes: Uint8Array): readonly [number, number] | null {
    if (bytes.byteLength <= ClipboardImageResources.gifHeaderLength)
      return null;
    const view = ClipboardImage.view(bytes);
    const screen = view.getUint8(ClipboardImageResources.gifFlagsOffset);
    let offset = ClipboardImageResources.gifHeaderLength
      + ((screen & Resources.gifColorTableFlag) === 0 ? 0 : ClipboardImageResources.gifColorEntryBytes * 2 ** ((screen & ClipboardImageResources.gifColorTableSizeMask) + 1));
    while (offset + 1 < bytes.byteLength && view.getUint8(offset) === Resources.gifExtensionIntroducer) {
      offset += ClipboardImageResources.gifExtensionHeaderLength;
      while (offset < bytes.byteLength && view.getUint8(offset) !== 0)
        offset += view.getUint8(offset) + 1;
      offset += 1;
    }
    if (offset + ClipboardImageResources.gifDescriptorLength > bytes.byteLength || view.getUint8(offset) !== Resources.gifImageSeparator)
      return null;
    return [
      Math.max(ClipboardImage.readUint16Le(bytes, ClipboardImageResources.gifScreenWidthOffset),
        ClipboardImage.readUint16Le(bytes, offset + ClipboardImageResources.gifLeftOffset) + ClipboardImage.readUint16Le(bytes, offset + ClipboardImageResources.gifWidthOffset)),
      Math.max(ClipboardImage.readUint16Le(bytes, ClipboardImageResources.gifScreenHeightOffset),
        ClipboardImage.readUint16Le(bytes, offset + ClipboardImageResources.gifTopOffset) + ClipboardImage.readUint16Le(bytes, offset + ClipboardImageResources.gifHeightOffset))
    ];
  }

  private static webpSizeOf(bytes: Uint8Array): readonly [number, number] | null {
    if (bytes.byteLength <= ClipboardImageResources.webpMinimumLength)
      return null;
    if (ClipboardImage.matches(bytes, ClipboardImageResources.webpChunkOffset, Resources.webpLossyChunk))
      return [ClipboardImage.readUint16Le(bytes, ClipboardImageResources.webpLossyWidthOffset) & ClipboardImageResources.webpDimensionMask, ClipboardImage.readUint16Le(bytes, ClipboardImageResources.webpLossyHeightOffset) & ClipboardImageResources.webpDimensionMask];
    if (ClipboardImage.matches(bytes, ClipboardImageResources.webpChunkOffset, Resources.webpLosslessChunk)) {
      const bits = ClipboardImage.readUint16Le(bytes, ClipboardImageResources.webpLosslessBitsOffset) + ClipboardImage.readUint16Le(bytes, ClipboardImageResources.webpLosslessHighOffset) * ClipboardImageResources.uint16Range;
      return [(bits & ClipboardImageResources.webpDimensionMask) + 1, Math.floor(bits / ClipboardImageResources.webpLosslessHeightDivisor) % ClipboardImageResources.webpLosslessHeightDivisor + 1];
    }
    if (ClipboardImage.matches(bytes, ClipboardImageResources.webpChunkOffset, Resources.webpExtendedChunk))
      return [ClipboardImage.readUint24Le(bytes, ClipboardImageResources.webpExtendedWidthOffset) + 1, ClipboardImage.readUint24Le(bytes, ClipboardImageResources.webpExtendedHeightOffset) + 1];
    return null;
  }

  private static readUint16(bytes: Uint8Array, offset: number): number {
    return ClipboardImage.view(bytes).getUint16(offset);
  }

  private static readUint32(bytes: Uint8Array, offset: number): number {
    return ClipboardImage.view(bytes).getUint32(offset);
  }

  private static readUint16Le(bytes: Uint8Array, offset: number): number {
    return ClipboardImage.view(bytes).getUint16(offset, true);
  }

  private static readUint24Le(bytes: Uint8Array, offset: number): number {
    return ClipboardImage.readUint16Le(bytes, offset) + ClipboardImage.view(bytes).getUint8(offset + 2) * ClipboardImageResources.uint16Range;
  }

  private static view(bytes: Uint8Array): DataView {
    return new DataView(bytes.buffer, bytes.byteOffset);
  }

  private static matches(bytes: Uint8Array, offset: number, signature: readonly (number | null)[]): boolean {
    return offset + signature.length < bytes.byteLength && signature.every((t, i) => Object.isNull(t) || bytes[offset + i] === t);
  }
}
