/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { open, readFile } from "node:fs/promises";

import "@noldova/context.core";

import { Resources } from "../../resources.ts";
import { FileErrors } from "./file-errors.ts";

export class TextFile {
  public static async readAsync(file: string, read: typeof readFile = readFile): Promise<string> {
    try {
      return await read(file, Resources.textEncoding);
    }
    catch (error) {
      if (!FileErrors.isUnsized(error))
        throw error;
      return await TextFile.readUnsizedAsync(file);
    }
  }

  private static async readUnsizedAsync(file: string): Promise<string> {
    const handle = await open(file);
    try {
      const chunks: Buffer[] = [];
      let bytesRead = Resources.fileReadChunkSize;
      while (bytesRead > 0) {
        const chunk = Buffer.alloc(Resources.fileReadChunkSize);
        bytesRead = (await handle.read(chunk, 0, Resources.fileReadChunkSize, null)).bytesRead;
        chunks.push(chunk.subarray(0, bytesRead));
      }
      return Buffer.concat(chunks).toString(Resources.textEncoding);
    }
    finally {
      await handle.close();
    }
  }
}
