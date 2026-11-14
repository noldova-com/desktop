/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ImageSizeResources {
  public static readonly pngSignature: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  public static readonly pngHeader: string = "IHDR";
  public static readonly pngHeaderEnd: number = 24;
  public static readonly jpegStart: number = 0xd8;
  public static readonly marker: number = 0xff;
  public static readonly markerLength: number = 2;
  public static readonly frameMarkers: readonly number[] = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf];
  public static readonly frameEnd: number = 9;
  public static readonly pngHeaderEncoding: BufferEncoding = "latin1";
  public static readonly pngHeaderStart: number = 12;
  public static readonly pngWidthOffset: number = 16;
  public static readonly pngHeightOffset: number = 20;
  public static readonly frameHeightOffset: number = 5;
  public static readonly frameWidthOffset: number = 7;
}
