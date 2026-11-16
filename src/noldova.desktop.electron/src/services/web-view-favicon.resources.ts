/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

export class WebViewFaviconResources {
  public static readonly decodeWorld: number = 1997;
  public static readonly decodeTimeout: number = 2000;
  public static readonly candidateLimit: number = 4;
  public static readonly byteLimit: number = 1_048_576;
  public static readonly side: number = 64;
  public static readonly pngLimit: number = 16_384;
  public static readonly pngPrefix: string = "data:image/png;base64,";
  public static readonly pngSignature: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  public static readonly base64Pattern: RegExp = /^[A-Za-z0-9+/]+={0,2}$/u;

  public static formatDecodeScript(source: string): string {
    return `(async () => {
  const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob("${source}"), t => t.charCodeAt(0))]));
  const scale = Math.min(1, ${WebViewFaviconResources.side} / Math.max(bitmap.width, bitmap.height));
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = new Uint8Array(await (await canvas.convertToBlob({ type: "image/png" })).arrayBuffer());
  let text = "";
  for (const value of png)
    text += String.fromCharCode(value);
  return btoa(text);
})().catch(() => null)`;
  }
}
