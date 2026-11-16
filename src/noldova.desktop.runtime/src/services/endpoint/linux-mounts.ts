/**
 * @license
 * Copyright (c) Noldova.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

import "@noldova/context.core";

import { Resources } from "../../resources.js";

export class LinuxMounts {
  private readonly readOnly: ReadonlyMap<bigint, boolean>;

  private constructor(readOnly: ReadonlyMap<bigint, boolean>) {
    this.readOnly = readOnly;
  }

  public static async readAsync(processFolder: string): Promise<LinuxMounts> {
    const text = await readFile(path.join(processFolder, Resources.ownProcessFolder, Resources.mountInfoFile), Resources.utf8Encoding);
    const readOnly = new Map<bigint, boolean>();
    for (const line of text.split(Resources.lineSeparator)) {
      const match = Resources.mountInfoPattern.exec(line);
      if (!Object.isNull(match))
        readOnly.set(LinuxMounts.encodeDevice(BigInt(String(match[1])), BigInt(String(match[2]))), String(match[3]).split(Resources.mountOptionSeparator).includes(Resources.readOnlyOption));
    }
    return new LinuxMounts(readOnly);
  }

  private static encodeDevice(major: bigint, minor: bigint): bigint {
    return ((major & ~Resources.deviceMajorLowMask) << Resources.deviceMajorHighShift) | ((major & Resources.deviceMajorLowMask) << Resources.deviceMajorLowShift)
      | ((minor & ~Resources.deviceMinorLowMask) << Resources.deviceMinorHighShift) | (minor & Resources.deviceMinorLowMask);
  }

  public isReadOnly(device: bigint): boolean {
    return this.readOnly.get(device) === true;
  }

  public isWritable(device: bigint): boolean {
    return this.readOnly.get(device) === false;
  }
}
