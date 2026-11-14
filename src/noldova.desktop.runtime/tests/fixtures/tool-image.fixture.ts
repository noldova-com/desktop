/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class ToolImageFixture {
  private static readonly PNG_SIGNATURE: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  public static png(width: number, height: number, header: string = "IHDR"): string {
    const size = Buffer.alloc(8);
    size.writeUInt32BE(width, 0);
    size.writeUInt32BE(height, 4);
    return Buffer.concat([Buffer.from(ToolImageFixture.PNG_SIGNATURE), Buffer.from([0, 0, 0, 13]), Buffer.from(header, "latin1"), size, Buffer.from([8, 6, 0, 0, 0])])
      .toString("base64");
  }

  public static jpeg(width: number, height: number): string {
    const frame = [0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff, 0x03];
    return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, ...frame]).toString("base64");
  }

  public static bytes(values: readonly number[]): string {
    return Buffer.from(values).toString("base64");
  }
}
