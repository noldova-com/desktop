/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { ClipboardImage } from "../../../src/app/models/clipboard-image";

describe("ClipboardImage", () => {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const bigEndian = (value: number): number[] => [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
  const pngOf = (width: number, height: number): Uint8Array =>
    new Uint8Array([...signature, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...bigEndian(width), ...bigEndian(height), 8, 6, 0, 0, 0, 0, 0, 0, 0]);
  const gif = Uint8Array.from(atob("R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="), t => t.charCodeAt(0));
  const sized = (bytes: Uint8Array, byteLength: number): Uint8Array => {
    const padded = new Uint8Array(byteLength);
    padded.set(bytes);
    return padded;
  };
  const sizeOf = async (bytes: Uint8Array): Promise<readonly number[]> => {
    const bitmap = await createImageBitmap(new Blob([bytes.slice()]));
    return [bitmap.width, bitmap.height];
  };
  const drawn = async (type: string, quality: number): Promise<Uint8Array> => {
    const canvas = new OffscreenCanvas(2, 3);
    canvas.getContext("2d")?.fillRect(0, 0, 2, 3);
    return new Uint8Array(await (await canvas.convertToBlob({ type, quality })).arrayBuffer());
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("takes PNG bytes as they are, up to 64 MiB, 16384 pixels a side and 50 million in all, such as a 5K screenshot", async () => {
    const png = pngOf(1, 1);
    const largest = sized(pngOf(5120, 2880), 64 * 1024 * 1024);
    const wide = pngOf(16384, 3051);

    expect(await ClipboardImage.readAsync(png)).toBe(png);
    expect(await ClipboardImage.readAsync(largest)).toBe(largest);
    expect(await ClipboardImage.readAsync(wide)).toBe(wide);
  });

  it("draws a JPEG, one with fill bytes or a lone marker before a marker, a GIF's first frame, and a lossy and a lossless WebP image as PNG of the same size", async () => {
    const jpeg = await drawn("image/jpeg", 1);
    const filled = new Uint8Array([...jpeg.slice(0, 2), 0xff, 0xff, ...jpeg.slice(2)]);
    const marked = new Uint8Array([...jpeg.slice(0, 2), 0xff, 0x01, ...jpeg.slice(2)]);
    const images = [jpeg, filled, marked, gif, await drawn("image/webp", 0.5), await drawn("image/webp", 1)];

    const read = await Promise.all(images.map(t => ClipboardImage.readAsync(t)));

    expect(read.map(t => [...t?.slice(0, 8) ?? []])).toEqual(images.map(() => signature));
    expect(await Promise.all(read.map(t => sizeOf(t ?? new Uint8Array())))).toEqual([[2, 3], [2, 3], [2, 3], [1, 1], [2, 3], [2, 3]]);
  });

  it("refuses bytes of another kind, more than 64 MiB, a bare signature, a PNG or GIF cut before its size, a JPEG or GIF without a frame, a JPEG without a frame header, a WebP of an unknown kind, or a JPEG, GIF or WebP that doesn't decode", async () => {
    const refused = [new TextEncoder().encode("not an image"), new TextEncoder().encode("BM image"), new Uint8Array(signature), new Uint8Array(), sized(pngOf(1, 1), 64 * 1024 * 1024 + 1),
      sized(gif, 64 * 1024 * 1024 + 1), new Uint8Array([...gif.slice(0, 10), 1, 2, 3]), new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 broken"),
      new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 1, 0, 1, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]), new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0, 2, 0, 0, 0, 0, 0]),
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0, 0, 0]), pngOf(1, 1).slice(0, 20), gif.slice(0, 10),
      new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8]), new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 2]), new Uint8Array([...gif.slice(0, 13), 0x3b]),
      new Uint8Array([...gif.slice(0, 10), 0, 0, 0, 0x3b, 0, 0, 0, 0, 0, 0, 0, 0, 0]), new Uint8Array([...gif.slice(0, 10), 0, 0, 0, 0x21, 0xf9, 4, 1, 0]),
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0x12, 0x34, 0x56, 0x78]), new TextEncoder().encode(`RIFF\u0000\u0000\u0000\u0000WEBPVP9 ${"\u0000".repeat(20)}`)];

    expect(await Promise.all(refused.map(t => ClipboardImage.readAsync(t)))).toEqual(refused.map(() => null));
  });

  it("refuses an image whose header declares more than 16384 pixels a side or 50 million in all, or none, without decoding it, past JPEG fill bytes and lone markers and to a GIF's first frame", async () => {
    const decode = vi.spyOn(globalThis, "createImageBitmap");
    const littleEndian = (value: number, bytes: number): number[] => Array.from({ length: bytes }, (_, i) => Math.floor(value / 256 ** i) % 256);
    const riff = (chunk: string, data: number[]): Uint8Array => new Uint8Array([...new TextEncoder().encode(`RIFF\u0000\u0000\u0000\u0000WEBP${chunk}`), 0, 0, 0, 0, ...data, 0, 0]);
    const decoy = new Uint8Array(49_156 + 19);
    decoy.set([0xff, 0xd8, 0xff, 0xff, 0xc0, 0, 17, 8, 0x5a, 0x82, 0x5a, 0x82, 3, 1, 0x22, 0]);
    decoy.set([0xff, 0xc0, 0, 17, 8, 0, 1, 0, 1, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], 49_156);
    const oversized = [
      pngOf(16384, 3052),
      pngOf(16385, 1),
      pngOf(1, 16385),
      pngOf(1, 0),
      pngOf(0xffffffff, 0xffffffff),
      pngOf(0, 1),
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc2, 0, 17, 8, 0xff, 0xff, 0xff, 0xff, 3, 1, 0x22, 0]),
      decoy,
      new Uint8Array([0xff, 0xd8, 0xff, 0x01, 0xff, 0xd0, 0xff, 0xc0, 0, 17, 8, 0x5a, 0x82, 0x5a, 0x82, 3, 1, 0x22, 0]),
      new Uint8Array([...gif.slice(0, 10), 0, 0, 0, 0x2c, 0, 0, 0, 0, 0xff, 0xff, 0xff, 0xff, 0, 0x3b]),
      new Uint8Array([...gif.slice(0, 19), 0x2c, 0xff, 0xff, 0xff, 0xff, 1, 0, 1, 0, 0, 0x3b]),
      new Uint8Array([...gif.slice(0, 6), 0xff, 0xff, 0xff, 0xff, ...gif.slice(10)]),
      riff("VP8 ", [0, 0, 0, 0x9d, 0x01, 0x2a, ...littleEndian(0x3fff, 2), ...littleEndian(0x3fff, 2)]),
      riff("VP8L", [0x2f, 0xff, 0xff, 0xff, 0x0f, 0, 0, 0, 0, 0]),
      riff("VP8X", [0, 0, 0, 0, ...littleEndian(0xffffff, 3), ...littleEndian(0xffffff, 3)])
    ];

    expect(await Promise.all(oversized.map(t => ClipboardImage.readAsync(t)))).toEqual(oversized.map(() => null));
    expect(decode).not.toHaveBeenCalled();
  });

  it("refuses a GIF when the canvas gives no 2D context, and closes the decoded image", async () => {
    vi.spyOn(OffscreenCanvas.prototype, "getContext").mockReturnValue(null);
    const closed = vi.spyOn(ImageBitmap.prototype, "close");

    expect(await ClipboardImage.readAsync(gif)).toBeNull();
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
