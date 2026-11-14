/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { lstat, open, readdir } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { BuildException } from "../../exceptions/build.exception.ts";
import { Resources } from "../../resources.ts";

export class PackagedArchitecture {
  public static async verifyAsync(application: string, architecture: string): Promise<string> {
    if (Object.isUndefined(Resources.machCpuTypes[architecture]))
      throw new BuildException(Resources.formatMachArchitectureUnknown(architecture, Object.keys(Resources.machCpuTypes)));
    let count = 0;
    for (const file of await PackagedArchitecture.listFilesAsync(application)) {
      const found = await PackagedArchitecture.describeAsync(file);
      if (Object.isNull(found))
        continue;
      if (found !== architecture)
        throw new BuildException(Resources.formatMachArchitectureMismatch(file, found, architecture));
      count++;
    }
    return Resources.formatMachArchitectureVerified(application, count, architecture);
  }

  private static async listFilesAsync(folder: string): Promise<readonly string[]> {
    const files: string[] = [];
    for (const name of await readdir(folder)) {
      const entry = path.join(folder, name);
      const status = await lstat(entry);
      if (status.isDirectory())
        files.push(...await PackagedArchitecture.listFilesAsync(entry));
      else if (status.isFile())
        files.push(entry);
    }
    return files;
  }

  private static async describeAsync(file: string): Promise<string | null> {
    const header = Buffer.alloc(Resources.machHeaderLength);
    const handle = await open(file, Resources.fileReadFlag);
    try {
      await handle.read(header, 0, header.length, 0);
    }
    finally {
      await handle.close();
    }
    if (Resources.machUniversalMagics.includes(header.readUInt32BE(0)) && header.readUInt32BE(Resources.machUniversalCountOffset) <= Resources.machUniversalArchitectureLimit)
      return Resources.machUniversalFile;
    if (header.readUInt32LE(0) === Resources.machThin32Magic)
      return Resources.mach32BitFile;
    if (header.readUInt32LE(0) !== Resources.machThinMagic)
      return null;
    const type = header.readUInt32LE(Resources.machCpuTypeOffset);
    return Object.entries(Resources.machCpuTypes).find(([, value]) => value === type)?.[0] ?? Resources.formatMachCpuType(type);
  }
}
