/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ClipboardImageResources {
  public static readonly pngHeaderChunkOffset: number = 12;
  public static readonly pngHeaderLength: number = 24;
  public static readonly pngWidthOffset: number = 16;
  public static readonly pngHeightOffset: number = 20;
  public static readonly jpegFirstMarkerOffset: number = 2;
  public static readonly jpegMarkerPrefix: number = 0xff;
  public static readonly jpegMarkerLookahead: number = 3;
  public static readonly jpegMarkerLength: number = 2;
  public static readonly jpegFrameLength: number = 9;
  public static readonly jpegFrameWidthOffset: number = 7;
  public static readonly jpegFrameHeightOffset: number = 5;
  public static readonly gifHeaderLength: number = 13;
  public static readonly gifFlagsOffset: number = 10;
  public static readonly gifColorEntryBytes: number = 3;
  public static readonly gifColorTableSizeMask: number = 0x07;
  public static readonly gifExtensionHeaderLength: number = 2;
  public static readonly gifDescriptorLength: number = 9;
  public static readonly gifScreenWidthOffset: number = 6;
  public static readonly gifScreenHeightOffset: number = 8;
  public static readonly gifLeftOffset: number = 1;
  public static readonly gifTopOffset: number = 3;
  public static readonly gifWidthOffset: number = 5;
  public static readonly gifHeightOffset: number = 7;
  public static readonly webpMinimumLength: number = 30;
  public static readonly webpChunkOffset: number = 12;
  public static readonly webpLossyWidthOffset: number = 26;
  public static readonly webpLossyHeightOffset: number = 28;
  public static readonly webpDimensionMask: number = 0x3fff;
  public static readonly webpLosslessBitsOffset: number = 21;
  public static readonly webpLosslessHighOffset: number = 23;
  public static readonly webpLosslessHeightDivisor: number = 0x4000;
  public static readonly webpExtendedWidthOffset: number = 24;
  public static readonly webpExtendedHeightOffset: number = 27;
  public static readonly uint16Range: number = 0x10000;
}
