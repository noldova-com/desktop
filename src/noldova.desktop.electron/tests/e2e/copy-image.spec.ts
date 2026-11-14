/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import "@noldova/context.core";

import { expect, test } from "./fixtures/main-process-test.fixture.ts";

test.describe("copy image", () => {
  test("the window's page copies a PNG image that the system clipboard holds, and a refused image, a JPEG among them, leaves the clipboard as it was", async ({ mainProcess }) => {
    const copyAsync = (bytes: number[] | string): Promise<unknown> => mainProcess.window.evaluate(async source => {
      const canvas = new OffscreenCanvas(3, 2);
      canvas.getContext("2d")?.fillRect(0, 0, 3, 2);
      const bytes = Array.isArray(source) ? new Uint8Array(source) : new Uint8Array(await (await canvas.convertToBlob({ type: source })).arrayBuffer());
      return globalThis.desktop?.copyImage(bytes);
    }, bytes);
    const readAsync = (): Promise<unknown> => mainProcess.application.evaluate(async ({ clipboard, nativeImage }) => {
      const png = (await clipboard.read()).find(t => t.types.includes("image/png"));
      const size = Object.isUndefined(png) ? { width: 0, height: 0 } : nativeImage.createFromBuffer(Buffer.from(await (await png.getType("image/png")).arrayBuffer())).getSize();
      return [size.width, size.height, await clipboard.readText()];
    });

    expect(await copyAsync("image/png")).toBe(true);
    expect(await readAsync()).toEqual([3, 2, String.empty]);

    await mainProcess.application.evaluate(({ clipboard }) => clipboard.writeText("kept"));
    expect(await copyAsync([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])).toBe(false);
    expect(await copyAsync([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 2, 3])).toBe(false);
    expect(await copyAsync("image/jpeg")).toBe(false);
    expect(await readAsync()).toEqual([0, 0, "kept"]);
    expect(mainProcess.acceptFailures(/An image was not copied/)).toHaveLength(3);
  });
});
