/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { type FileHandle, open, readdir } from "node:fs/promises";
import path from "node:path";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class NativeBinaries {
  public static async listAsync(folder: string): Promise<readonly string[]> {
    const files = (await readdir(folder, { recursive: true, withFileTypes: true }))
      .filter(t => t.isFile())
      .map(t => path.relative(folder, path.join(t.parentPath, t.name)).split(path.sep).join(Resources.pathSegmentSeparator))
      .sort();
    const binaries: string[] = [];
    for (const relative of files) {
      if (!await NativeBinaries.isNativeAsync(path.join(folder, relative)))
        continue;
      if (Resources.filePatternCharacters.test(relative))
        throw new BuildException(Resources.formatNativeBinaryWildcard(relative));
      binaries.push(relative);
    }
    return binaries;
  }

  private static async isNativeAsync(file: string): Promise<boolean> {
    const handle = await open(file);
    try {
      return await NativeBinaries.readsAsNativeAsync(handle);
    }
    finally {
      await handle.close();
    }
  }

  private static async readsAsNativeAsync(handle: FileHandle): Promise<boolean> {
    const header = Buffer.alloc(Resources.nativeHeaderLength);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (Resources.nativeMagics.some(t => bytesRead >= t.length && header.subarray(0, t.length).equals(t)))
      return true;
    if (bytesRead >= Resources.nativeUniversalHeaderLength && header.subarray(0, Resources.nativeUniversalMagic.length).equals(Resources.nativeUniversalMagic))
      return header.readUInt32BE(Resources.machUniversalCountOffset) < Resources.nativeJavaFirstVersion;
    if (bytesRead < Resources.nativeHeaderLength || !header.subarray(0, Resources.nativeDosMagic.length).equals(Resources.nativeDosMagic))
      return false;
    const signature = Buffer.alloc(Resources.nativePeMagic.length);
    const read = await handle.read(signature, 0, signature.length, header.readUInt32LE(Resources.nativePeOffsetPosition));
    return read.bytesRead === signature.length && signature.equals(Resources.nativePeMagic);
  }
}
