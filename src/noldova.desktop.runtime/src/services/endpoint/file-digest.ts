/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { createHash } from "node:crypto";
import type { FileHandle } from "node:fs/promises";

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class FileDigest {
  public static async computeAsync(handle: FileHandle, size: number): Promise<string> {
    const step = Math.ceil(size / Resources.programDigestRanges);
    const starts = Array.from({ length: Resources.programDigestRanges }, (_, index) => index * step);
    const digests = await Promise.all(starts.map(t => FileDigest.computeRangeAsync(handle, t, Math.min(size, t + step))));
    return createHash(Resources.programDigestAlgorithm).update(digests.join(String.empty)).digest(Resources.hexEncoding);
  }

  private static async computeRangeAsync(handle: FileHandle, start: number, end: number): Promise<string> {
    const hash = createHash(Resources.programDigestAlgorithm);
    const buffer = Buffer.allocUnsafe(Resources.programDigestChunkBytes);
    for (let position = start; position < end;) {
      const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, end - position), position);
      if (bytesRead === 0)
        break;
      hash.update(buffer.subarray(0, bytesRead));
      position += bytesRead;
    }
    return hash.digest(Resources.hexEncoding);
  }
}
